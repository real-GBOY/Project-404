import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AppError, httpStatusForError } from "../kernel/errors.js";
import { enterContext, getContext } from "../kernel/logging/context.js";
import type { ErrorTracker } from "./errors/error-tracker.js";

const CORRELATION_HEADER = "x-correlation-id";

/**
 * Installs the cross-cutting HTTP behaviour on the root Fastify instance
 * (§7.12): a per-request correlation id + ambient context, and the single
 * place errors become responses (§3.4). Request logging is Fastify's own,
 * fed the shared pino instance in the composition root.
 */
export function installObservability<App extends FastifyInstance>(
  app: App,
  deps: { errorTracker: ErrorTracker },
): void {
  app.addHook("onRequest", async (req, reply) => {
    // req.id is set by the factory's genReqId (honours an inbound
    // x-correlation-id header, else a fresh uuid).
    const id = String(req.id ?? randomUUID());
    // enterWith: no wrapping callback available across the Fastify lifecycle.
    enterContext({ correlationId: id });
    reply.header(CORRELATION_HEADER, id);
  });

  app.setErrorHandler((err: unknown, req, reply) => {
    deps.errorTracker.capture(err);
    const correlationId = getContext()?.correlationId;
    const fastifyErr = err as { statusCode?: number; code?: string; message?: string };

    // Fastify's own validation / payload errors → 400.
    const status =
      err instanceof AppError
        ? httpStatusForError(err)
        : typeof fastifyErr.statusCode === "number"
          ? fastifyErr.statusCode
          : 500;

    if (err instanceof AppError) {
      reply.status(status).send({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
          correlationId,
        },
      });
      return;
    }

    if (status < 500) {
      reply.status(status).send({
        error: {
          code: fastifyErr.code ?? "request.invalid",
          message: fastifyErr.message ?? "Bad request.",
          correlationId,
        },
      });
      return;
    }

    req.log.error({ err }, "unhandled error");
    reply.status(500).send({
      error: { code: "internal", message: "Something went wrong.", correlationId },
    });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({
      error: { code: "route.not_found", message: `No route for ${req.method} ${req.url}.` },
    });
  });
}
