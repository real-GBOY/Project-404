import pino from "pino";
import { getConfig } from "../config.js";
import { getContext } from "./context.js";

/**
 * Structured logging (observability start-here, §7.12). Every line is JSON in
 * production; pretty-printed in development. The correlation id from the
 * request context is mixed into every line automatically.
 */
const cfg = getConfig();

export const rootLogger = pino({
  level: cfg.logLevel,
  base: { service: "auric-core" },
  redact: {
    paths: [
      "password",
      "*.password",
      "passwordHash",
      "*.passwordHash",
      "token",
      "*.token",
      "authorization",
      "req.headers.authorization",
    ],
    censor: "[redacted]",
  },
  mixin() {
    const ctx = getContext();
    if (!ctx) return {};
    return {
      correlationId: ctx.correlationId,
      ...(ctx.userId ? { userId: ctx.userId } : {}),
    };
  },
  transport:
    cfg.nodeEnv === "development"
      ? { target: "pino-pretty", options: { translateTime: "SYS:standard", ignore: "pid,hostname,service" } }
      : undefined,
});

export type Logger = pino.Logger;

/** A child logger tagged with the module name. */
export function moduleLogger(module: string): Logger {
  return rootLogger.child({ module });
}
