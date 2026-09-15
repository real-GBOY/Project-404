import { getAccessToken, getRefreshToken, setTokens } from "./token-store";

/** `?a=1&b=2` from a params object — skips `undefined`/`null` values. Used by every `src/api/*.ts` list fetch. */
export function toQueryString(params?: object): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** Thrown by `apiFetch` for any non-2xx response, carrying the backend's own error shape. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Set once by `AuthProvider`; called when a request can't be recovered by refreshing. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null): void {
  onSessionExpired = fn;
}

async function rawFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`/api${path}`, { ...init, headers });
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { tokens: { accessToken: string; refreshToken: string } };
  setTokens(body.tokens);
  return true;
}

/**
 * The one HTTP entrypoint for every `src/api/<domain>.ts` fetch function.
 * Attaches the current access token, retries once through a silent refresh
 * on a 401, and throws `ApiError` (with the backend's `error.code`) for the
 * caller / React Query to handle. `T = void` for 204 responses.
 */
export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  let res = await rawFetch(path, init);

  if (res.status === 401 && getRefreshToken()) {
    if (await tryRefresh()) res = await rawFetch(path, init);
  }

  if (res.status === 401) {
    setTokens(null);
    onSessionExpired?.();
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      res.status,
      body?.error?.code ?? "unknown",
      body?.error?.message ?? "Something went wrong. Please try again.",
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
