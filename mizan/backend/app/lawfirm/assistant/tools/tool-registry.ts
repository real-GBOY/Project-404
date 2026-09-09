import { Inject, Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { AppError } from "@core/kernel/errors.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { PERMISSION_PROVIDER } from "@core/kernel/tokens.js";
import type { IPermissionProvider } from "@core/contracts/index.js";
import type { AiToolDef } from "../ai/ai-client.js";
import { ReadTools } from "./read-tools.js";
import { WriteTools } from "./write-tools.js";
import { zodToJsonSchema } from "./zod-to-json-schema.js";
import type { AssistantTool, ToolContext, ToolResult } from "./tool.js";

const log = moduleLogger("assistant-tools");

/**
 * The one place a model-requested tool call becomes a Mizan operation. The
 * gate order is deliberate and non-negotiable:
 *
 *   lookup → parse args → validate args → **RBAC check in tenant** → execute
 *
 * Every failure is returned as a `ToolResult` (never thrown), so the agent loop
 * can hand the real error back to the model and let it explain — it never
 * fabricates success.
 */
@Injectable()
export class ToolRegistry {
  private readonly byName: Map<string, AssistantTool>;

  constructor(
    readTools: ReadTools,
    writeTools: WriteTools,
    @Inject(PERMISSION_PROVIDER) private readonly permissions: IPermissionProvider,
  ) {
    this.byName = new Map();
    for (const tool of [...readTools.tools(), ...writeTools.tools()]) {
      this.byName.set(tool.name, tool);
    }
  }

  list(): AssistantTool[] {
    return [...this.byName.values()];
  }

  /** OpenAI-style function definitions for the upstream request. */
  openAiToolDefs(): AiToolDef[] {
    return this.list().map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters),
      },
    }));
  }

  async run(name: string, rawArguments: string, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.byName.get(name);
    if (!tool) {
      return err(name, "assistant.unknown_tool", `There is no tool named "${name}".`);
    }

    let parsedArgs: unknown;
    try {
      parsedArgs = rawArguments.trim() ? JSON.parse(rawArguments) : {};
    } catch {
      return err(name, "assistant.bad_tool_arguments", "The tool arguments were not valid JSON.");
    }

    const validated = tool.parameters.safeParse(parsedArgs);
    if (!validated.success) {
      return {
        name,
        ok: false,
        error: {
          code: "assistant.invalid_tool_arguments",
          message:
            "Invalid arguments: " +
            validated.error.issues
              .map((i) => `${i.path.join(".") || "(root)"} — ${i.message}`)
              .join("; "),
        },
      };
    }

    if (tool.permission) {
      const { action, resource } = tool.permission;
      const allowed = await readInTenant(() =>
        this.permissions.can(ctx.userId, action, resource),
      ).catch(() => false);
      if (!allowed) {
        return err(
          name,
          "auth.forbidden",
          `You don't have permission to ${action} ${resource}, so I can't do that.`,
        );
      }
    }

    try {
      const data = await tool.execute(validated.data, ctx);
      return { name, ok: true, data };
    } catch (e) {
      if (e instanceof AppError) {
        // Domain-level failure (not found, conflict, validation, forbidden) —
        // safe to surface verbatim.
        log.info({ tool: name, code: e.code, kind: e.kind }, "tool execution rejected");
        return { name, ok: false, error: { code: e.code, message: e.message } };
      }
      log.error({ tool: name, err: e }, "tool execution threw");
      return err(
        name,
        "assistant.tool_failed",
        "That operation failed unexpectedly and was not completed.",
      );
    }
  }
}

function err(name: string, code: string, message: string): ToolResult {
  return { name, ok: false, error: { code, message } };
}
