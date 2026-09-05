import type { ApiErrorBody } from "@/types/api";

/** A non-2xx API response, mapped from the backend `AppError` body. Ported
 *  from mizan/web/src/lib/api/api-error.ts. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Array<{ path: string; message: string }>;

  constructor(status: number, body: Partial<ApiErrorBody> | null) {
    super(body?.message ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.code ?? "unknown";
    this.fields = body?.details?.fields ?? [];
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

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
