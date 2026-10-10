import { ApiError } from "@/services/http";

/** A message safe to show a person for a failed request: the server's own wording for API errors, a plain network line otherwise. */
export function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "We could not reach the server. Check your connection and try again.";
}
