/**
 * The body Core's `AppExceptionFilter` sends: `{ error: { code, message, details?, correlationId? } }`.
 * A flat `{ code, message }` body is tolerated too (proxies, test doubles).
 */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: {
    fields?: Array<{ path: string; message: string }>;
  } & Record<string, unknown>;
  correlationId?: string;
}

/** A non-2xx API response, mapped from the backend error envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Array<{ path: string; message: string }>;
  readonly correlationId: string | undefined;

  constructor(status: number, body: Partial<ApiErrorBody> | { error?: Partial<ApiErrorBody> } | null) {
    const inner = unwrap(body);
    super(inner?.message ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = inner?.code ?? "unknown";
    this.fields = inner?.details?.fields ?? [];
    this.correlationId = inner?.correlationId;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isValidation(): boolean {
    return this.status === 400 || this.status === 409;
  }
}

function unwrap(body: unknown): Partial<ApiErrorBody> | null {
  if (!body || typeof body !== "object") return null;
  const envelope = (body as { error?: unknown }).error;
  if (envelope && typeof envelope === "object") return envelope as Partial<ApiErrorBody>;
  return body as Partial<ApiErrorBody>;
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
