import { ApiError } from "./api-error.js";
import { createRefresher } from "./refresh.js";
import type { TokenStoreCore } from "./token-store.js";

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
  /**
   * Extra request headers (e.g. `Idempotency-Key`). They cannot replace Authorization or
   * Content-Type — those stay owned by the client.
   */
  headers?: Record<string, string>;
}

export interface HttpClientOptions {
  /** `/api` (same-origin) or an absolute `https://…/api`. */
  baseUrl: string;
  tokens: TokenStoreCore;
  /** Path of the refresh endpoint, e.g. `/auth/refresh`. Body: `{ refreshToken }` → `{ tokens }`. */
  refreshPath: string;
  /** Called after a 401 that could not be recovered; the tokens have already been cleared. */
  onLogout?: () => void;
  onRefreshed?: () => void;
  /** Injectable for tests. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

export interface HttpClient {
  <T>(path: string, opts?: RequestOptions): Promise<T>;
  /** Prefix an API path with the base; absolute URLs pass through. */
  withApiBase(pathOrUrl: string): string;
  /** `{ Authorization }` for the current access token, or `{}` when signed out. */
  bearerHeaders(): Record<string, string>;
  /** Run (or join) the single in-flight refresh. */
  refresh(): Promise<boolean>;
}

/**
 * Only forward an `AbortSignal` the runtime's `fetch` will accept. Always true in a real
 * browser; under Vitest+jsdom the DOM's `AbortSignal` fails Node fetch's brand check, so we
 * drop it rather than throw.
 */
function usableSignal(signal: AbortSignal | undefined): AbortSignal | undefined {
  if (!signal) return undefined;
  try {
    new Request("http://localhost/", { signal });
    return signal;
  } catch {
    return undefined;
  }
}

const ABSOLUTE = /^https?:\/\//i;

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const { baseUrl, tokens } = options;
  const doFetch = (...args: Parameters<typeof fetch>) => (options.fetch ?? fetch)(...args);
  const baseIsAbsolute = ABSOLUTE.test(baseUrl);
  const origin = (globalThis as { location?: { origin?: string } }).location?.origin ?? "http://localhost";

  function buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = new URL(`${baseUrl}${path}`, origin);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        for (const v of Array.isArray(value) ? value : [value]) {
          if (v !== undefined && v !== null) url.searchParams.append(key, String(v));
        }
      }
    }
    return baseIsAbsolute ? url.href : url.pathname + url.search;
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

  /**
   * Whether the last refresh failed because the server was busy or unreachable (429, 5xx, no connection), as opposed to refusing
   * the token. Only a refused token ends the session: a rate limit, a restart or a dead spot in the signal must not log anyone out.
   */
  let refreshUnavailable = false;

  const refresh = createRefresher({
    tokens,
    onRefreshed: options.onRefreshed,
    exchange: async (refreshToken) => {
      refreshUnavailable = false;
      for (let attempt = 1; ; attempt++) {
        let res: Response;
        try {
          res = await doFetch(buildUrl(options.refreshPath), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
        } catch {
          refreshUnavailable = true;
          return null;
        }
        if (res.status === 429 && attempt < 2) {
          const asked = Number(res.headers.get("retry-after"));
          const pause = Math.min(5_000, (Number.isFinite(asked) && res.headers.has("retry-after") ? asked : 1) * 1_000);
          await new Promise((r) => setTimeout(r, pause));
          continue;
        }
        if (res.ok) {
          const data = (await res.json()) as { tokens: { accessToken: string; refreshToken: string } };
          return data.tokens;
        }
        refreshUnavailable = res.status === 429 || res.status >= 500;
        return null;
      }
    },
  });

  function bearerHeaders(): Record<string, string> {
    const token = tokens.getAccess();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function raw(path: string, opts: RequestOptions): Promise<Response> {
    const extra = Object.fromEntries(
      Object.entries(opts.headers ?? {}).filter(
        ([k]) => !/^(authorization|content-type)$/i.test(k),
      ),
    );
    const headers: Record<string, string> = { ...extra, ...(opts.anonymous ? {} : bearerHeaders()) };
    let body: string | FormData | undefined;
    if (opts.form) {
      body = opts.form;
    } else if (opts.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    return doFetch(buildUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body,
      signal: usableSignal(opts.signal),
    });
  }

  const client = async <T>(path: string, opts: RequestOptions = {}): Promise<T> => {
    let res = await raw(path, opts);

    if (res.status === 401 && !opts.anonymous) {
      if (await refresh()) {
        res = await raw(path, opts);
      } else if (refreshUnavailable) {
        // the session is intact, it just could not be renewed right now: fail this request, keep the person signed in
        throw new ApiError(503, { error: { code: "auth.refresh_unavailable", message: "Your session could not be renewed right now. Try again in a moment." } });
      } else {
        tokens.clear();
        options.onLogout?.();
        throw await parseError(res);
      }
    }

    if (!res.ok) throw await parseError(res);

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  };

  return Object.assign(client, {
    withApiBase: (pathOrUrl: string) => (ABSOLUTE.test(pathOrUrl) ? pathOrUrl : buildUrl(pathOrUrl)),
    bearerHeaders,
    refresh,
  });
}
