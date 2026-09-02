import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { CurrentUser } from "../../http/decorators.js";
import { JwtAuthGuard } from "../../http/jwt-auth.guard.js";
import { ZodBody } from "../../http/zod.pipe.js";
import type { Principal } from "../../http/principal.js";
import { USER_PROVIDER } from "../../kernel/tokens.js";
import { Inject } from "@nestjs/common";
import type { IUserProvider } from "../../contracts/index.js";
import { IdentityService } from "../application/identity-service.js";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  requestEmailVerificationSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../validation/schemas.js";

/**
 * Authentication (§7.1). Every route here is **public** except `logout-all`
 * (that one needs a valid access token). The password-reset and email-resend
 * responses are deliberately uniform so they never reveal whether an address
 * is registered.
 *
 * Access token = short-lived HS256 JWT carrying `sub, email, org, perms`.
 * Refresh token = opaque random string, stored hashed, rotated on every use,
 * whole family revoked on reuse (theft detection). See docs/tenancy.md for the
 * nullable `org` claim and tenant switching.
 */
@Controller("auth")
export class AuthController {
  constructor(private readonly service: IdentityService) {}

  /** POST /api/auth/register — create the (global) user. 201. New users start `pending`. */
  @Post("register")
  @HttpCode(201)
  async register(@Body(ZodBody(registerSchema)) input: z.infer<typeof registerSchema>) {
    return { user: await this.service.register(input) };
  }

  /**
   * POST /api/auth/login — verify credentials and issue a token pair. Resolves
   * the active tenant from `body.organizationId` → the sole membership → none.
   * Returns `{ user, tokens, organizations }` (the membership list feeds a
   * tenant switcher).
   */
  @Post("login")
  async login(
    @Body(ZodBody(loginSchema)) input: z.infer<typeof loginSchema>,
    @Headers("user-agent") userAgent?: string,
  ) {
    return this.service.login({ ...input, ...(userAgent ? { userAgent } : {}) });
  }

  /**
   * POST /api/auth/refresh — rotate the refresh token. Pass `organizationId` to
   * switch the active tenant (re-mints the access token with that org's perms,
   * no re-login).
   */
  @Post("refresh")
  async refresh(@Body(ZodBody(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    return { tokens: await this.service.refresh(body.refreshToken, body.organizationId) };
  }

  /** POST /api/auth/logout — revoke a single refresh token (this device). 204. */
  @Post("logout")
  @HttpCode(204)
  async logout(@Body(ZodBody(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    await this.service.logout(body.refreshToken);
  }

  /** POST /api/auth/logout-all — revoke every refresh token for the caller (204). Requires auth. */
  @Post("logout-all")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logoutAll(@CurrentUser() user: Principal) {
    await this.service.logoutAll(user.userId);
  }

  /** POST /api/auth/password/forgot — email a reset link if the address exists. Always 202 + a uniform message. */
  @Post("password/forgot")
  @HttpCode(202)
  async forgotPassword(
    @Body(ZodBody(requestPasswordResetSchema)) body: z.infer<typeof requestPasswordResetSchema>,
  ) {
    await this.service.requestPasswordReset(body.email);
    return { message: "If that email is registered, a reset link is on its way." };
  }

  /** POST /api/auth/password/reset — consume the token, set the password, revoke all sessions (204). */
  @Post("password/reset")
  @HttpCode(204)
  async resetPassword(
    @Body(ZodBody(resetPasswordSchema)) body: z.infer<typeof resetPasswordSchema>,
  ) {
    await this.service.resetPassword(body.token, body.password);
  }

  /** POST /api/auth/email/verify — consume an email-verification token; moves the user to `active` (204). */
  @Post("email/verify")
  @HttpCode(204)
  async verifyEmail(@Body(ZodBody(verifyEmailSchema)) body: z.infer<typeof verifyEmailSchema>) {
    await this.service.verifyEmail(body.token);
  }

  /** POST /api/auth/email/resend — re-send a verification link if the account needs one. Always 202 + uniform message. */
  @Post("email/resend")
  @HttpCode(202)
  async resendVerification(
    @Body(ZodBody(requestEmailVerificationSchema))
    body: z.infer<typeof requestEmailVerificationSchema>,
  ) {
    await this.service.requestEmailVerification(body.email);
    return { message: "If that account needs verification, a new link is on its way." };
  }
}

/** The current session's identity, active tenant, and permission keys (from the token). */
@Controller("me")
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(@Inject(USER_PROVIDER) private readonly users: IUserProvider) {}

  /** GET /api/me — `{ user, organizationId, permissions }`. `organizationId` is null for an orgless token. */
  @Get()
  async me(@CurrentUser() principal: Principal) {
    return {
      user: await this.users.getUser(principal.userId),
      organizationId: principal.organizationId,
      permissions: principal.permissions,
    };
  }
}
