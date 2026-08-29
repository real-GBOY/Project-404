import type { NextFunction, Request as ExpressRequest, Response } from "express";
import type { ZodTypeAny, infer as ZodInfer } from "zod";
import { ValidationError } from "../kernel/errors.js";

/**
 * Small HTTP helpers shared by every module's routes. Controllers stay thin
 * (§3.4): validate, call a use case, shape the response. No business logic.
 */

/**
 * Route params as flat strings. `@types/express@5` widened `ParamsDictionary`
 * values to `string | string[]` for repeatable params; AURIC routes never use
 * those, so we pin params back to `string` for ergonomic controllers.
 */
export type ApiRequest = ExpressRequest<Record<string, string>>;

export type AsyncHandler = (req: ApiRequest, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap an async handler so thrown errors reach the error middleware. */
export function handler(fn: AsyncHandler) {
  return (req: ExpressRequest, res: Response, next: NextFunction) => {
    fn(req as ApiRequest, res, next).catch(next);
  };
}

/** Normalize a possibly-array header to a single string. */
export function header(req: { headers: Record<string, string | string[] | undefined> }, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

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
