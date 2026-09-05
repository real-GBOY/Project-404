import { tokenStore } from "@/lib/auth/token-store";
import { authEvents } from "@/lib/auth/auth-events";
import { ApiError } from "./api-error";

/**
 * Ported from mizan/web/src/lib/api/http-client.ts. Native has no same-origin
 * dev proxy, so the base is always an absolute URL — set
 * `EXPO_PUBLIC_API_BASE_URL` per environment (see `.env.example`); falls back
 * to the VPS API for local development against the real backend.
 */
const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://13-220-157-42.sslip.io/api";

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue | QueryValue[]>;
  /** multipart body — pass a FormData and it is sent as-is. */
  form?: FormData;
  signal?: AbortSignal;
  /** skip the Authorization header (login, refresh). */
  anonymous?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      for (const v of Array.isArray(value) ? value : [value]) {
        if (v !== undefined && v !== null) url.searchParams.append(key, String(v));
      }
    }
  }
  return url.href;
}

async function parseError(res: Response): Promise<ApiError> {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty / non-JSON body */
  }
  return new ApiError(res.status, body);
}

let refreshInFlight: Promise<boolean> | null = null;

/** Single-flight refresh so concurrent 401s trigger only one refresh call. */
async function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const refreshToken = await tokenStore.getRefresh();
    if (!refreshToken) return false;
    try {
      const res = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { tokens: { accessToken: string; refreshToken: string } };
      await tokenStore.set(data.tokens.accessToken, data.tokens.refreshToken);
      authEvents.emit("tokens-refreshed");
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function raw(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (!opts.anonymous) {
    const token = tokenStore.getAccess();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  return fetch(buildUrl(path, opts.query), {
    method: opts.method ?? "GET",
    headers,
    body,
    signal: opts.signal,
  });
}

/**
 * The single entry point for API calls. Attaches auth, retries once through a
 * token refresh on 401, and turns non-2xx into `ApiError`.
 */
export async function httpClient<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await raw(path, opts);

  if (res.status === 401 && !opts.anonymous) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      res = await raw(path, opts);
    } else {
      await tokenStore.clear();
      authEvents.emit("logout");
      throw await parseError(res);
    }
  }

  if (!res.ok) throw await parseError(res);

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Absolute URL for an endpoint that needs to be handed to a native module
 *  (e.g. downloading a file with `expo-file-system`) rather than fetched here. */
export function apiUrl(path: string, query?: RequestOptions["query"]): string {
  return buildUrl(path, query);
}
