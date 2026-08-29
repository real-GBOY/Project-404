/**
 * The Core error taxonomy. Every layer throws these; the HTTP error handler
 * (observability/middleware/error-handler.ts) is the single place that maps
 * them to status codes. Domain and application code never imports HTTP.
 */

export type ErrorKind =
  | "validation" // 400 — malformed input
  | "unauthenticated" // 401 — no / invalid credentials
  | "forbidden" // 403 — authenticated but not allowed
  | "not_found" // 404 — resource does not exist
  | "conflict" // 409 — violates a uniqueness / state rule
  | "rate_limited" // 429
  | "internal"; // 500 — unexpected

export interface AppErrorOptions {
  /** Machine-readable code, e.g. "identity.email_taken". */
  code: string;
  /** Human-readable, safe to return to the client. */
  message: string;
  kind: ErrorKind;
  /** Structured detail (e.g. per-field validation errors). Returned to client. */
  details?: unknown;
  /** Underlying error, kept for logs only — never serialized to the client. */
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: string;
  readonly kind: ErrorKind;
  readonly details?: unknown;

  constructor(opts: AppErrorOptions) {
    super(opts.message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "AppError";
    this.code = opts.code;
    this.kind = opts.kind;
    this.details = opts.details;
  }
}

export const ValidationError = (code: string, message: string, details?: unknown) =>
  new AppError({ code, message, kind: "validation", details });

export const Unauthenticated = (code = "auth.unauthenticated", message = "Authentication required.") =>
  new AppError({ code, message, kind: "unauthenticated" });

export const Forbidden = (code = "auth.forbidden", message = "You do not have permission to do this.") =>
  new AppError({ code, message, kind: "forbidden" });

export const NotFound = (code: string, message: string) =>
  new AppError({ code, message, kind: "not_found" });

export const Conflict = (code: string, message: string, details?: unknown) =>
  new AppError({ code, message, kind: "conflict", details });

export const Internal = (message = "Something went wrong.", cause?: unknown) =>
  new AppError({ code: "internal", message, kind: "internal", cause });

const STATUS_BY_KIND: Record<ErrorKind, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
};

export function httpStatusForError(err: unknown): number {
  return err instanceof AppError ? STATUS_BY_KIND[err.kind] : 500;
}
