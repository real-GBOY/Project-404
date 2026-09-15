import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "./env";
import { getAccessToken, getRefreshToken, setTokens, type TokenPair } from "./token-store";
import { ENDPOINTS } from "./endpoints";

/** Thrown for any non-2xx response, carrying the backend's own `{error:{code,message}}` shape. */
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

/** The one axios instance every `src/api/*.ts` file calls through. */
export const http = axios.create({ baseURL: API_BASE_URL });

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

/** Refresh tokens rotate server-side (single-use) and reusing an already-rotated
 *  one revokes the whole session as theft detection. A page with several
 *  queries in flight gets several concurrent 401s, so every caller here must
 *  share one in-flight refresh instead of each racing its own — otherwise all
 *  but the first lose that race and take the user's whole session down with
 *  them. Uses the bare `axios` client, not `http` — a failed refresh must not
 *  re-trigger this same interceptor. */
let inFlightRefresh: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  inFlightRefresh = (async () => {
    try {
      const res = await axios.post<{ tokens: TokenPair }>(`${API_BASE_URL}${ENDPOINTS.auth.refresh}`, { refreshToken });
      setTokens(res.data.tokens);
      return true;
    } catch {
      return false;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: { code?: string; message?: string } }>) => {
    const original = error.config as RetriableConfig | undefined;

    if (error.response?.status === 401 && original && !original._retried && getRefreshToken()) {
      original._retried = true;
      if (await tryRefresh()) return http(original);
    }

    if (error.response?.status === 401) {
      setTokens(null);
      onSessionExpired?.();
    }

    const body = error.response?.data;
    throw new ApiError(
      error.response?.status ?? 0,
      body?.error?.code ?? "unknown",
      body?.error?.message ?? "Something went wrong. Please try again.",
    );
  },
);

/** GET, optionally with query params (undefined/null values are dropped). */
export async function get<T = unknown>(url: string, params?: object): Promise<T> {
  const res = await http.get<T>(url, { params });
  return res.data;
}

export async function post<T = unknown>(url: string, body?: unknown): Promise<T> {
  const res = await http.post<T>(url, body);
  return res.data;
}

export async function patch<T = unknown>(url: string, body?: unknown): Promise<T> {
  const res = await http.patch<T>(url, body);
  return res.data;
}
