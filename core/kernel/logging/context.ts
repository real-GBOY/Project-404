import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request ambient context. Set once by the correlation-id middleware and
 * read anywhere (logger, audit, outbox) without threading it through every
 * function signature.
 */
export interface RequestContext {
  correlationId: string;
  userId?: string;
  /**
   * The active tenant (§ docs/tenancy.md). Set by the auth hook after the JWT
   * `org` claim is checked against membership; pushed into Postgres as
   * `app.organization_id` per transaction so RLS filters every tenant-scoped
   * table. Absent for pre-tenant requests (login, org creation) and system work.
   */
  organizationId?: string;
  /**
   * System context: signup, provider webhooks, the outbox worker. Runs on the
   * `auric_system` connection (BYPASSRLS) and skips the `SET LOCAL` tenant
   * push. Never set from an end-user request.
   */
  system?: boolean;
  locale?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Bind the context for the remainder of the current async execution without a
 * wrapping callback. Used by the Fastify `onRequest` hook, whose lifecycle
 * cannot be wrapped in `run()`.
 */
export function enterContext(ctx: RequestContext): void {
  storage.enterWith(ctx);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Mutate the current context in place (e.g. attach userId after auth). */
export function patchContext(patch: Partial<RequestContext>): void {
  const ctx = storage.getStore();
  if (ctx) Object.assign(ctx, patch);
}

/**
 * Run `fn` with the current context extended by `patch` (a fresh context if
 * there is none). Used where a service must pin the tenant/user for the work it
 * is about to do — e.g. login resolving the active org before issuing tokens —
 * regardless of whether it was reached over HTTP or called directly.
 */
export function withContext<T>(patch: Partial<RequestContext>, fn: () => T): T {
  const current = storage.getStore();
  const next: RequestContext = {
    correlationId: current?.correlationId ?? "internal",
    ...current,
    ...patch,
  };
  return storage.run(next, fn);
}

/**
 * Run `fn` in a fresh system context (§ docs/tenancy.md): no tenant, routed to
 * the `auric_system` connection, RLS bypassed. Used by signup, provider
 * webhooks, and the outbox worker — never by an end-user request path. Carries
 * the current correlation id through if there is one.
 */
export function runAsSystem<T>(fn: () => T): T {
  const correlationId = storage.getStore()?.correlationId ?? "system";
  return storage.run({ correlationId, system: true }, fn);
}
