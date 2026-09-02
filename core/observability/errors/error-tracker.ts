import { rootLogger } from "@core/kernel/logging/logger.js";
import { getContext } from "@core/kernel/logging/context.js";
import { AppError } from "@core/kernel/errors.js";

const log = rootLogger.child({ module: "errors" });

/**
 * Basic error tracking (§7.12 start-here). A seam where a real error service
 * (Sentry, etc.) is dropped in "Later" without touching call sites.
 */
export interface ErrorTracker {
  capture(error: unknown, context?: Record<string, unknown>): void;
}

export const loggingErrorTracker: ErrorTracker = {
  capture(error, context) {
    // Expected, typed failures are not "errors" worth paging on.
    if (error instanceof AppError && error.kind !== "internal") return;
    log.error(
      {
        err: error,
        correlationId: getContext()?.correlationId,
        ...context,
      },
      "unhandled error captured",
    );
  },
};
