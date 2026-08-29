import { Router } from "express";
import { handler, parseBody } from "../../http/handler.js";
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
): Router {
  const r = Router();

  r.post(
    "/auth/register",
    handler(async (req, res) => {
      const input = parseBody(registerSchema, req.body);
      const user = await service.register(input);
      res.status(201).json({ user });
    }),
  );

  r.post(
    "/auth/login",
    handler(async (req, res) => {
      const input = parseBody(loginSchema, req.body);
      const result = await service.login({ ...input, userAgent: req.headers["user-agent"] });
      res.json(result);
    }),
  );

  r.post(
    "/auth/refresh",
    handler(async (req, res) => {
      const { refreshToken } = parseBody(refreshSchema, req.body);
      const tokens = await service.refresh(refreshToken);
      res.json({ tokens });
    }),
  );

  r.post(
    "/auth/logout",
    handler(async (req, res) => {
      const { refreshToken } = parseBody(refreshSchema, req.body);
      await service.logout(refreshToken);
      res.status(204).end();
    }),
  );

  r.post(
    "/auth/logout-all",
    ctx.authenticate,
    handler(async (req, res) => {
      const principal = requireAuth(req);
      await service.logoutAll(principal.userId);
      res.status(204).end();
    }),
  );

  r.post(
    "/auth/password/forgot",
    handler(async (req, res) => {
      const { email } = parseBody(requestPasswordResetSchema, req.body);
      await service.requestPasswordReset(email);
      res.status(202).json({ message: "If that email is registered, a reset link is on its way." });
    }),
  );

  r.post(
    "/auth/password/reset",
    handler(async (req, res) => {
      const { token, password } = parseBody(resetPasswordSchema, req.body);
      await service.resetPassword(token, password);
      res.status(204).end();
    }),
  );

  r.post(
    "/auth/email/verify",
    handler(async (req, res) => {
      const { token } = parseBody(verifyEmailSchema, req.body);
      await service.verifyEmail(token);
      res.status(204).end();
    }),
  );

  r.post(
    "/auth/email/resend",
    handler(async (req, res) => {
      const { email } = parseBody(requestEmailVerificationSchema, req.body);
      await service.requestEmailVerification(email);
      res.status(202).json({ message: "If that account needs verification, a new link is on its way." });
    }),
  );

  r.get(
    "/me",
    ctx.authenticate,
    handler(async (req, res) => {
      const principal = requireAuth(req);
      const user = await userProvider.getUser(principal.userId);
      res.json({ user, permissions: principal.permissions });
    }),
  );

  return r;
}
