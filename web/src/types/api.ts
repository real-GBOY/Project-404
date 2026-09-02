/**
 * Shared API contract shapes. These mirror the backend's response envelopes
 * (see the Part-1 assessment / `core/http`), not database entities.
 */

/** The backend `AppError` body: `{ code, message, details? }`. */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: {
    fields?: Array<{ path: string; message: string }>;
  } & Record<string, unknown>;
}

/** Keyset-paginated list envelope used by list endpoints. */
export interface Paginated<T> {
  items: T[];
  nextCursor?: string;
  total?: number;
}

/** Money is always a currency + amount pair. Never summed across currencies. */
export interface Money {
  currency: string;
  amount: string;
}
