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
 *
 * ─── Adding a tool is adding an AI-accessible API endpoint. Review it as one: ──
 *  1. Permission     — a concrete `{ action, resource }` (never null).
 *  2. Tenant         — the service scopes by organization_id AND the table is
 *                      under RLS. If not, do not add the tool.
 *  3. Resources      — it can only reach what the permission implies.
 *  4. Sensitive data — the service's view shape excludes internal / credential /
 *                      other-user PII fields. Never `JSON.stringify(rawRow)`.
 *  5. Enforcement    — authorization lives in the *service*, not just here.
 *  6. Mutation       — writes set `mutates: true` (⇒ model confirmation + a
 *                      `lawfirm.assistant.write` audit row).
 *  7. Audit          — covered by the per-turn `lawfirm.assistant.query` row.
 *  8. Tests          — add a cross-tenant case + a permission-deny case to
 *                      tests/assistant-security.test.ts.
 * The invariant: no model output can make Mizan return or modify data the
 * authenticated principal is not authorized to access. See docs/assistant.md.
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
