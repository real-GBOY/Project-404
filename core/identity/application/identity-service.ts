import type { UnitOfWork } from "../../kernel/db/db.js";
import type { Clock } from "../../kernel/clock.js";
import { newId } from "../../kernel/id.js";
import { Conflict, Unauthenticated, ValidationError } from "../../kernel/errors.js";
import { moduleLogger } from "../../kernel/logging/logger.js";
import type { IAuditLogger, IEventBus, IPermissionProvider, User } from "../../contracts/index.js";
import { UserEntity } from "../domain/user.js";
import type { UserRepository } from "../infrastructure/user-repository.js";
import type { RefreshTokenRepository } from "../infrastructure/refresh-token-repository.js";
import type { VerificationTokenRepository } from "../infrastructure/verification-token-repository.js";
import type { PasswordHasher } from "../infrastructure/password-hasher.js";
import type { JwtService } from "../infrastructure/jwt-service.js";
import {
  emailVerificationRequested,
  passwordResetRequested,
  userEmailVerified,
  userPasswordReset,
  userRegistered,
} from "../events/events.js";

const log = moduleLogger("identity");

export interface IdentityServiceOptions {
  requireEmailVerification: boolean;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  emailVerificationTtlSeconds: number;
  passwordResetTtlSeconds: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface IdentityServiceDeps {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  verificationTokens: VerificationTokenRepository;
  hasher: PasswordHasher;
  jwt: JwtService;
  events: IEventBus;
  audit: IAuditLogger;
  permissions: IPermissionProvider;
  uow: UnitOfWork;
  clock: Clock;
  options: IdentityServiceOptions;
}

/**
 * Identity use cases (§7.1). Each public method is one use case and owns its
 * transaction boundary (§3.4): it opens the transaction, makes its domain
 * changes, records audit, and publishes events — all inside that boundary.
 */
export class IdentityService {
  constructor(private readonly d: IdentityServiceDeps) {}

  async register(input: {
    email: string;
    password: string;
    displayName?: string;
    locale?: string;
  }): Promise<User> {
    const { d } = this;
    return d.uow.transaction(async () => {
      if (await d.users.emailExists(input.email)) {
        throw Conflict("identity.email_taken", "That email is already registered.");
      }

      const passwordHash = await d.hasher.hash(input.password);
      const user = UserEntity.register({
        id: newId("usr"),
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? null,
        locale: input.locale ?? null,
        requireVerification: d.options.requireEmailVerification,
      });
      await d.users.insert(user);

      await d.audit.record({
        actorId: user.id,
        actorType: "user",
        action: "user.registered",
        resourceType: "user",
        resourceId: user.id,
        after: { email: user.email, status: user.status },
      });

      await d.events.publish(userRegistered({ userId: user.id, email: user.email, locale: user.locale }));

      if (d.options.requireEmailVerification) {
        const token = await d.verificationTokens.issue({
          userId: user.id,
          purpose: "email_verification",
          ttlSeconds: d.options.emailVerificationTtlSeconds,
        });
        await d.events.publish(
          emailVerificationRequested({
            userId: user.id,
            email: user.email,
            token,
            locale: user.locale,
          }),
        );
      }

      log.info({ userId: user.id }, "user registered");
      return user.toPublic();
    });
  }

  async login(input: {
    email: string;
    password: string;
    userAgent?: string;
  }): Promise<{ user: User; tokens: TokenPair }> {
    const { d } = this;
    const genericError = Unauthenticated("identity.invalid_credentials", "Incorrect email or password.");

    return d.uow.transaction(async () => {
      const user = await d.users.findByEmail(input.email);
      if (!user) {
        // Spend time hashing anyway to blunt timing-based user enumeration.
        await d.hasher.hash(input.password).catch(() => undefined);
        throw genericError;
      }

      const ok = await d.hasher.verify(user.passwordHash, input.password);
      if (!ok) throw genericError;

      if (!user.canLogIn) {
        throw Unauthenticated(
          "identity.account_not_active",
          user.status === "pending"
            ? "Please verify your email address before signing in."
            : "This account has been disabled.",
        );
      }

      if (d.hasher.needsRehash(user.passwordHash)) {
        user.changePassword(await d.hasher.hash(input.password));
        await d.users.update(user);
      }

      const tokens = await this.issueTokens(user.id, user.email, input.userAgent ?? null);

      await d.audit.record({
        actorId: user.id,
        actorType: "user",
        action: "user.logged_in",
        resourceType: "user",
        resourceId: user.id,
      });

      return { user: user.toPublic(), tokens };
    });
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const { d } = this;
    const invalid = Unauthenticated("identity.invalid_refresh_token", "Session expired. Please sign in again.");

    const hash = d.jwt.hashRefreshToken(refreshToken);
    const stored = await d.uow.transaction(() => d.refreshTokens.findByHash(hash));
    if (!stored) throw invalid;

    if (stored.revokedAt || stored.rotatedTo) {
      // A revoked/rotated token being reused: possible theft. Revoke the whole
      // family in its OWN committed transaction — this must survive the
      // rejection we are about to throw.
      await d.uow.transaction(() => d.refreshTokens.revokeAllForUser(stored.userId));
      log.warn({ userId: stored.userId }, "reuse of a rotated refresh token — all sessions revoked");
      throw invalid;
    }
    if (stored.expiresAt < d.clock.now()) throw invalid;

    return d.uow.transaction(async () => {
      const user = await d.users.findById(stored.userId);
      if (!user || !user.canLogIn) throw invalid;

      const tokens = await this.issueTokens(user.id, user.email, null);
      await d.refreshTokens.revoke(stored.id, "rotated");
      return tokens;
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const { d } = this;
    await d.uow.transaction(async () => {
      const stored = await d.refreshTokens.findByHash(d.jwt.hashRefreshToken(refreshToken));
      if (stored && !stored.revokedAt) await d.refreshTokens.revoke(stored.id);
    });
  }

  async logoutAll(userId: string): Promise<void> {
    const { d } = this;
    await d.uow.transaction(() => d.refreshTokens.revokeAllForUser(userId));
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { d } = this;
    await d.uow.transaction(async () => {
      const user = await d.users.findByEmail(email);
      // Never reveal whether the email exists.
      if (!user) {
        log.info({ email }, "password reset requested for unknown email — ignored");
        return;
      }
      const token = await d.verificationTokens.issue({
        userId: user.id,
        purpose: "password_reset",
        ttlSeconds: d.options.passwordResetTtlSeconds,
      });
      await d.events.publish(
        passwordResetRequested({ userId: user.id, email: user.email, token, locale: user.locale }),
      );
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { d } = this;
    await d.uow.transaction(async () => {
      const userId = await d.verificationTokens.consume(token, "password_reset");
      if (!userId) {
        throw ValidationError("identity.invalid_reset_token", "This reset link is invalid or has expired.");
      }
      const user = await d.users.findById(userId);
      if (!user) throw ValidationError("identity.invalid_reset_token", "This reset link is invalid or has expired.");

      user.changePassword(await d.hasher.hash(newPassword));
      await d.users.update(user);
      await d.refreshTokens.revokeAllForUser(user.id);

      await d.audit.record({
        actorId: user.id,
        actorType: "user",
        action: "user.password_reset",
        resourceType: "user",
        resourceId: user.id,
      });
      await d.events.publish(userPasswordReset({ userId: user.id }));
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const { d } = this;
    await d.uow.transaction(async () => {
      const userId = await d.verificationTokens.consume(token, "email_verification");
      if (!userId) {
        throw ValidationError(
          "identity.invalid_verification_token",
          "This verification link is invalid or has expired.",
        );
      }
      const user = await d.users.findById(userId);
      if (!user) return;
      if (user.isEmailVerified) return;

      user.markEmailVerified(d.clock.now());
      await d.users.update(user);

      await d.audit.record({
        actorId: user.id,
        actorType: "user",
        action: "user.email_verified",
        resourceType: "user",
        resourceId: user.id,
      });
      await d.events.publish(userEmailVerified({ userId: user.id, email: user.email }));
    });
  }

  async requestEmailVerification(email: string): Promise<void> {
    const { d } = this;
    await d.uow.transaction(async () => {
      const user = await d.users.findByEmail(email);
      if (!user || user.isEmailVerified) return;
      const token = await d.verificationTokens.issue({
        userId: user.id,
        purpose: "email_verification",
        ttlSeconds: d.options.emailVerificationTtlSeconds,
      });
      await d.events.publish(
        emailVerificationRequested({ userId: user.id, email: user.email, token, locale: user.locale }),
      );
    });
  }

  private async issueTokens(userId: string, email: string, userAgent: string | null): Promise<TokenPair> {
    const { d } = this;
    const perms = await d.permissions.permissionsFor(userId);
    const accessToken = d.jwt.signAccessToken({ sub: userId, email, perms });
    const { token: refreshToken, hash } = d.jwt.newRefreshToken();
    await d.refreshTokens.create({
      userId,
      tokenHash: hash,
      expiresAt: new Date(d.clock.now().getTime() + d.options.refreshTokenTtlSeconds * 1000),
      userAgent,
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: d.options.accessTokenTtlSeconds,
      tokenType: "Bearer",
    };
  }
}
