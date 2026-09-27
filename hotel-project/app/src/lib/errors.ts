import { ApiError } from "@/config";

/** A user-facing message for a failed mutation: the server's own message for 4xx, generic otherwise. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    if (error.fields.length > 0)
      return error.fields.map((f) => `${f.path}: ${f.message}`).join(" · ");
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
