import type { FastifyPluginAsync } from "fastify";
import { parseBody } from "../../http/handler.js";
import type { RouteContext } from "../../http/route-context.js";
import { requireAuth } from "./auth-middleware.js";
import type { IdentityService } from "../application/identity-service.js";
import type { IUserProvider } from "../../contracts/index.js";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  requestEmailVerificationSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../validation/schemas.js";

export function identityRoutes(
  service: IdentityService,
  userProvider: IUserProvider,
  ctx: RouteContext,
): FastifyPluginAsync {
  return async (app) => {
    app.post("/auth/register", async (req, reply) => {
      const input = parseBody(registerSchema, req.body);
      const user = await service.register(input);
      reply.status(201).send({ user });
    });

    app.post("/auth/login", async (req, reply) => {
      const input = parseBody(loginSchema, req.body);
      const ua = req.headers["user-agent"];
      reply.send(await service.login({ ...input, ...(ua ? { userAgent: ua } : {}) }));
    });

    app.post("/auth/refresh", async (req, reply) => {
      const { refreshToken } = parseBody(refreshSchema, req.body);
      reply.send({ tokens: await service.refresh(refreshToken) });
    });

    app.post("/auth/logout", async (req, reply) => {
      const { refreshToken } = parseBody(refreshSchema, req.body);
      await service.logout(refreshToken);
      reply.status(204).send();
    });

    app.post("/auth/logout-all", { preHandler: ctx.authenticate }, async (req, reply) => {
      await service.logoutAll(requireAuth(req).userId);
      reply.status(204).send();
    });

    app.post("/auth/password/forgot", async (req, reply) => {
      const { email } = parseBody(requestPasswordResetSchema, req.body);
      await service.requestPasswordReset(email);
      reply.status(202).send({ message: "If that email is registered, a reset link is on its way." });
    });

    app.post("/auth/password/reset", async (req, reply) => {
      const { token, password } = parseBody(resetPasswordSchema, req.body);
      await service.resetPassword(token, password);
      reply.status(204).send();
    });

    app.post("/auth/email/verify", async (req, reply) => {
      const { token } = parseBody(verifyEmailSchema, req.body);
      await service.verifyEmail(token);
      reply.status(204).send();
    });

    app.post("/auth/email/resend", async (req, reply) => {
      const { email } = parseBody(requestEmailVerificationSchema, req.body);
      await service.requestEmailVerification(email);
      reply.status(202).send({ message: "If that account needs verification, a new link is on its way." });
    });

    app.get("/me", { preHandler: ctx.authenticate }, async (req, reply) => {
      const principal = requireAuth(req);
      reply.send({ user: await userProvider.getUser(principal.userId), permissions: principal.permissions });
    });
  };
}
