import type { z } from "zod";

/**
 * The authenticated caller's context, threaded into every tool. Identical to
 * what a normal HTTP request carries — the assistant creates **no** new
 * identity. RBAC and tenant isolation are enforced against exactly this.
 *
 * `currentContext` is UI-supplied ("the user is looking at record X") and
 * deliberately an open bag: Core has no idea what record types a product has
 * (a matter, a lead, a unit, …), only that a screen name and zero or more
 * opaque hint ids may be present. Never trusted for authorization — only used
 * by the product's own system prompt to disambiguate references.
 */
export interface ToolContext {
  userId: string;
  organizationId: string;
  locale: string;
  correlationId: string;
  currentContext?: { screen?: string; [hint: string]: string | undefined };
}

/**
 * One capability exposed to the model, over the product's own domain. Every
 * tool:
 *  - declares the RBAC permission it needs (checked before `execute` runs, via
 *    the same `IPermissionProvider` the HTTP layer uses),
 *  - validates its arguments with a Zod schema,
 *  - delegates to an existing product service — it never touches the database,
 *    SQL, or another module's tables directly.
 *
 * The invariant: no model output can make a product return or modify data the
 * authenticated principal is not authorized to access. See
 * core/assistant/README.md and each product's own tools/tool.ts checklist for
 * what adding a tool requires.
 */
export interface AssistantTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  /** `null` for a tool that needs no extra permission beyond the assistant-surface gate. */
  permission: { action: string; resource: string } | null;
  /** `true` for write tools — the orchestrator may ask the user to confirm. */
  mutates?: boolean;
  parameters: S;
  execute(args: z.infer<S>, ctx: ToolContext): Promise<unknown>;
}

/** The registry's outcome for one tool call — always resolved, never thrown. */
export interface ToolResult {
  name: string;
  ok: boolean;
  /** Present when ok. Shaped/trimmed for the model. */
  data?: unknown;
  /** Present when !ok. Safe, user-facing. */
  error?: { code: string; message: string };
}
