import type { ZodTypeAny, infer as ZodInfer } from "zod";
import { ValidationError } from "../kernel/errors.js";

/**
 * Small HTTP helpers shared by every module's route plugin. Controllers stay
 * thin (§3.4): validate, call a use case, shape the response. No business
 * logic. Fastify handles async + thrown errors natively, so there is no
 * handler wrapper — a thrown AppError reaches `setErrorHandler`.
 */

export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): ZodInfer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw ValidationError("request.invalid_body", "The request body is invalid.", {
      fields: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data;
}

export function parseQuery<S extends ZodTypeAny>(schema: S, query: unknown): ZodInfer<S> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw ValidationError("request.invalid_query", "The query parameters are invalid.", {
      fields: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data;
}

export function parseParams<S extends ZodTypeAny>(schema: S, params: unknown): ZodInfer<S> {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw ValidationError("request.invalid_params", "The path parameters are invalid.", {
      fields: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  return result.data;
}
