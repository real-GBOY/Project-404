/**
 * A tiny event bus so `lib/api` can signal `logout` without importing the auth
 * provider (which would be a dependency cycle). `AuthProvider` subscribes.
 * Ported verbatim from mizan/web/src/lib/auth/auth-events.ts.
 */
type AuthEvent = "logout" | "tokens-refreshed";

const listeners = new Map<AuthEvent, Set<() => void>>();

export const authEvents = {
  on(event: AuthEvent, fn: () => void): () => void {
    const set = listeners.get(event) ?? new Set();
    set.add(fn);
    listeners.set(event, set);
    return () => set.delete(fn);
  },
  emit(event: AuthEvent): void {
    listeners.get(event)?.forEach((fn) => fn());
  },
};
