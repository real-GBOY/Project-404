import type { z } from "zod";

/**
 * The authenticated caller's context, threaded into every tool. Identical to
 * what a normal HTTP request carries — the assistant creates **no** new
 * identity. RBAC and tenant isolation are enforced against exactly this.
 */
export interface ToolContext {
  userId: string;
  organizationId: string;
  locale: string;
  correlationId: string;
  /** UI-supplied hints ("the user is looking at matter X"). Never trusted for
   *  authorization — only used to disambiguate references. */
  currentContext?: { screen?: string; matterId?: string; clientId?: string };
}

/**
 * A Mizan capability exposed to the model. Every tool:
 *  - declares the RBAC permission it needs (checked before `execute` runs),
 *  - validates its arguments with a Zod schema,
 *  - delegates to an existing Mizan service — it never touches the database,
 *    SQL, or another module's tables directly.
 */
export interface AssistantTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  /** `null` for a tool that needs no extra permission beyond `use:assistant`. */
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
