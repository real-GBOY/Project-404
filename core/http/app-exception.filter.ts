import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { AppError, httpStatusForError } from "../kernel/errors.js";
import { getContext } from "../kernel/logging/context.js";
import { rootLogger } from "../kernel/logging/logger.js";
import { ERROR_TRACKER } from "../kernel/tokens.js";
import type { ErrorTracker } from "../observability/errors/error-tracker.js";

/**
 * The single place errors become responses (§3.4). Domain/application code
 * throws `AppError` (or a Core helper); this maps `kind → status` and shapes
 * the body. Replaces the old Fastify `setErrorHandler`.
 */
@Injectable()
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(@Inject(ERROR_TRACKER) private readonly errorTracker: ErrorTracker) {}

  catch(err: unknown, host: ArgumentsHost): void {
    this.errorTracker.capture(err);
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const correlationId = getContext()?.correlationId;

    if (err instanceof AppError) {
      reply.status(httpStatusForError(err)).send({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
          correlationId,
        },
      });
      return;
    }

    // Nest's own HttpException-shaped errors (e.g. 404, payload too large).
    const e = err as { status?: number; statusCode?: number; code?: string; message?: string };
    const status = e.status ?? e.statusCode ?? 500;
    if (status < 500) {
      reply.status(status).send({
        error: { code: e.code ?? "request.invalid", message: e.message ?? "Bad request.", correlationId },
      });
      return;
    }

    rootLogger.error({ err }, "unhandled error");
    reply.status(500).send({
      error: { code: "internal", message: "Something went wrong.", correlationId },
    });
  }
}
