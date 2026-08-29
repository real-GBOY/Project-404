import type { NextFunction, Request, Response } from "express";
import { AppError, httpStatusForError } from "../../kernel/errors.js";
import { getContext } from "../../kernel/logging/context.js";
import type { ErrorTracker } from "../errors/error-tracker.js";

/**
 * The single place that turns an error into an HTTP response (§3.4). Domain
 * and application code throw typed AppErrors; everything else becomes a
 * generic 500 with no internal detail leaked.
 */
export function errorHandler(tracker: ErrorTracker) {
  return function handleError(err: unknown, _req: Request, res: Response, next: NextFunction): void {
    if (res.headersSent) return next(err);

    tracker.capture(err);
    const status = httpStatusForError(err);
    const correlationId = getContext()?.correlationId;

    if (err instanceof AppError) {
      res.status(status).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
          correlationId,
        },
      });
      return;
    }

    res.status(500).json({
      error: { code: "internal", message: "Something went wrong.", correlationId },
    });
  };
}

/** 404 fallthrough for unmatched routes. */
export function notFoundHandler() {
  return function handleNotFound(req: Request, res: Response): void {
    res.status(404).json({
      error: { code: "route.not_found", message: `No route for ${req.method} ${req.path}.` },
    });
  };
}
