import { ApiError } from "@/services/http";

/**
 * The text to show for a failed request: a message chosen for the backend's error code if there is one, else the fallback.
 * (Backend messages are English and technical; the interface shows its own translated wording.)
 */
export function messageFor(
  err: unknown,
  fallback: string,
  byCode: Record<string, string> = {},
): string {
  return err instanceof ApiError ? (byCode[err.code] ?? fallback) : fallback;
}
