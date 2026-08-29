import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request ambient context. Set once by the correlation-id middleware and
 * read anywhere (logger, audit, outbox) without threading it through every
 * function signature.
 */
export interface RequestContext {
  correlationId: string;
  userId?: string;
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
