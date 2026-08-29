import type { NextFunction, Request, Response } from "express";
import { rootLogger } from "../../kernel/logging/logger.js";

const log = rootLogger.child({ module: "http" });

/** One structured line per request, with method, path, status, and duration. */
export function requestLogger() {
  return function logRequest(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const line = {
        method: req.method,
        path: req.route ? req.baseUrl + req.route.path : req.originalUrl.split("?")[0],
        status: res.statusCode,
        durationMs: Math.round(ms * 100) / 100,
      };
      if (res.statusCode >= 500) log.error(line, "request failed");
      else if (res.statusCode >= 400) log.warn(line, "request rejected");
      else log.info(line, "request");
    });
    next();
  };
}
