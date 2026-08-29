import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { runWithContext } from "../../kernel/logging/context.js";

const HEADER = "x-correlation-id";

/**
 * The first middleware in the chain (§7.12 "request correlation IDs").
 * Establishes the per-request context so every log line, audit row, and
 * outbox message downstream can be tied back to this request.
 */
export function correlationId() {
  return function withCorrelationId(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[HEADER];
    const id = (Array.isArray(incoming) ? incoming[0] : incoming)?.trim() || randomUUID();
    res.setHeader(HEADER, id);
    runWithContext({ correlationId: id }, () => next());
  };
}
