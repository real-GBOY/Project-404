import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";
import { metrics } from "./metrics.js";

/** Records every response's method, status class and duration. No paths or identities are recorded. */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    const start = process.hrtime.bigint();
    res.on("finish", () => metrics.observeRequest(req.method ?? "GET", res.statusCode, Number(process.hrtime.bigint() - start) / 1e9));
    next();
  }
}
