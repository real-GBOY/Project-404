import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "../../kernel/db/db.js";
import type { Clock } from "../../kernel/clock.js";
import type { AuricConfig } from "../../kernel/config.js";
import { newId } from "../../kernel/id.js";
import { Conflict, Forbidden, Unauthenticated, ValidationError } from "../../kernel/errors.js";
import { moduleLogger } from "../../kernel/logging/logger.js";
import { withContext } from "../../kernel/logging/context.js";
import {
  AUDIT_LOGGER,
  CLOCK,
  CONFIG,
  EVENT_BUS,
  JWT_SERVICE,
  ORGANIZATION_PROVIDER,
  PASSWORD_HASHER,
  PERMISSION_PROVIDER,
  REQUIRE_EMAIL_VERIFICATION,
  UNIT_OF_WORK,
} from "../../kernel/tokens.js";
import type {
  IAuditLogger,
  IEventBus,
  IOrganizationProvider,
  IPermissionProvider,
  OrganizationMembership,
  User,
} from "../../contracts/index.js";
import { UserEntity } from "../domain/user.js";
import { UserRepository } from "../infrastructure/user-repository.js";
import { RefreshTokenRepository } from "../infrastructure/refresh-token-repository.js";
import { VerificationTokenRepository } from "../infrastructure/verification-token-repository.js";
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

const EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60 * 24; // 24h
const PASSWORD_RESET_TTL_SECONDS = 60 * 60; // 1h

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

/**
 * Identity use cases (§7.1). Each public method is one use case and owns its
 * transaction boundary (§3.4): it opens the transaction, makes its domain
 * changes, records audit, and publishes events — all inside that boundary.
 */
@Injectable()
export class IdentityService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly verificationTokens: VerificationTokenRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(JWT_SERVICE) private readonly jwt: JwtService,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(PERMISSION_PROVIDER) private readonly permissions: IPermissionProvider,
    @Inject(ORGANIZATION_PROVIDER) private readonly organizations: IOrganizationProvider,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CONFIG) private readonly config: AuricConfig,
    @Inject(REQUIRE_EMAIL_VERIFICATION) private readonly requireEmailVerification: boolean,
  ) {}

  async register(input: {
    email: string;
    password: string;
    displayName?: string;
    locale?: string;
  }): Promise<User> {
    return this.uow.transaction(async () => {
      if (await this.users.emailExists(input.email)) {
        throw Conflict("identity.email_taken", "That email is already registered.");
      }

      const passwordHash = await this.hasher.hash(input.password);
      const user = UserEntity.register({
        id: newId("usr"),
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? null,
        locale: input.locale ?? null,
        requireVerification: this.requireEmailVerification,
      });
      await this.users.insert(user);

      await this.audit.record({
        actorId: user.id,
        actorType: "user",
        action: "user.registered",
        resourceType: "user",
        resourceId: user.id,
        after: { email: user.email, status: user.status },
      });

      await this.events.publish(userRegistered({ userId: user.id, email: user.email, locale: user.locale }));

      if (this.requireEmailVerification) {
        const token = await this.verificationTokens.issue({
          userId: user.id,
          purpose: "email_verification",
          ttlSeconds: EMAIL_VERIFICATION_TTL_SECONDS,
        });
        await this.events.publish(
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
    /** The tenant to sign in to. Omit to use the sole membership, or none. */
    organizationId?: string;
    userAgent?: string;
  }): Promise<{ user: User; tokens: TokenPair; organizations: OrganizationMembership[] }> {
    const genericError = Unauthenticated("identity.invalid_credentials", "Incorrect email or password.");

    const user = await this.users.findByEmail(input.email);
    if (!user) {
      // Spend time hashing anyway to blunt timing-based user enumeration.
      await this.hasher.hash(input.password).catch(() => undefined);
      throw genericError;
    }

    const ok = await this.hasher.verify(user.passwordHash, input.password);
    if (!ok) throw genericError;

    if (!user.canLogIn) {
      throw Unauthenticated(
        "identity.account_not_active",
        user.status === "pending"
          ? "Please verify your email address before signing in."
          : "This account has been disabled.",
      );
    }

    // Resolving the tenant precedes it — read memberships with just the user
    // pinned so the `organization_members` RLS policy's user branch matches.
    const memberships = await withContext({ userId: user.id }, () =>
      this.organizations.membershipsForUser(user.id),
    );
    const activeOrg = this.resolveActiveOrg(input.organizationId, memberships);

    return withContext({ userId: user.id, organizationId: activeOrg ?? undefined }, () =>
      this.uow.transaction(async () => {
        if (this.hasher.needsRehash(user.passwordHash)) {
          user.changePassword(await this.hasher.hash(input.password));
          await this.users.update(user);
        }

        const tokens = await this.issueTokens(user.id, user.email, activeOrg, input.userAgent ?? null);

        await this.audit.record({
          actorId: user.id,
          actorType: "user",
          action: "user.logged_in",
          resourceType: "user",
          resourceId: user.id,
          ...(activeOrg ? { after: { organizationId: activeOrg } } : {}),
        });

        return { user: user.toPublic(), tokens, organizations: memberships };
      }),
    );
  }

  /**
   * Rotate the refresh token. Optionally switch the active tenant: pass
   * `organizationId` to mint an access token for a different org the user
   * belongs to (§ docs/tenancy.md) — no re-login needed.
   */
  async refresh(refreshToken: string, organizationId?: string): Promise<TokenPair> {
    const invalid = Unauthenticated("identity.invalid_refresh_token", "Session expired. Please sign in again.");

    const hash = this.jwt.hashRefreshToken(refreshToken);
    const stored = await this.uow.transaction(() => this.refreshTokens.findByHash(hash));
    if (!stored) throw invalid;

    if (stored.revokedAt || stored.rotatedTo) {
      // A revoked/rotated token being reused: possible theft. Revoke the whole
      // family in its OWN committed transaction — this must survive the
      // rejection we are about to throw.
      await this.uow.transaction(() => this.refreshTokens.revokeAllForUser(stored.userId));
      log.warn({ userId: stored.userId }, "reuse of a rotated refresh token — all sessions revoked");
      throw invalid;
    }
    if (stored.expiresAt < this.clock.now()) throw invalid;

    const user = await this.uow.transaction(() => this.users.findById(stored.userId));
    if (!user || !user.canLogIn) throw invalid;

    const memberships = await withContext({ userId: user.id }, () =>
      this.organizations.membershipsForUser(user.id),
    );
    const activeOrg = this.resolveActiveOrg(organizationId, memberships);

    return withContext({ userId: user.id, organizationId: activeOrg ?? undefined }, () =>
      this.uow.transaction(async () => {
        const tokens = await this.issueTokens(user.id, user.email, activeOrg, null);
        await this.refreshTokens.revoke(stored.id, "rotated");
        return tokens;
      }),
    );
  }

  /**
   * Which tenant a session is for: the one asked for (must be a membership),
   * else the sole membership, else none (an orgless token — valid only on
   * non-tenant routes until the user picks or creates an org).
   */
  private resolveActiveOrg(
    requested: string | undefined,
    memberships: OrganizationMembership[],
  ): string | null {
    if (requested) {
      if (!memberships.some((m) => m.organizationId === requested)) {
        throw Forbidden("identity.not_a_member", "You are not a member of that organization.");
      }
      return requested;
    }
    return memberships.length === 1 ? memberships[0]!.organizationId : null;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.uow.transaction(async () => {
      const stored = await this.refreshTokens.findByHash(this.jwt.hashRefreshToken(refreshToken));
      if (stored && !stored.revokedAt) await this.refreshTokens.revoke(stored.id);
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.uow.transaction(() => this.refreshTokens.revokeAllForUser(userId));
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.uow.transaction(async () => {
      const user = await this.users.findByEmail(email);
      // Never reveal whether the email exists.
      if (!user) {
        log.info({ email }, "password reset requested for unknown email — ignored");
        return;
      }
      const token = await this.verificationTokens.issue({
        userId: user.id,
        purpose: "password_reset",
        ttlSeconds: PASSWORD_RESET_TTL_SECONDS,
      });
      await this.events.publish(
        passwordResetRequested({ userId: user.id, email: user.email, token, locale: user.locale }),
      );
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.uow.transaction(async () => {
      const userId = await this.verificationTokens.consume(token, "password_reset");
      if (!userId) {
        throw ValidationError("identity.invalid_reset_token", "This reset link is invalid or has expired.");
      }
      const user = await this.users.findById(userId);
      if (!user) throw ValidationError("identity.invalid_reset_token", "This reset link is invalid or has expired.");

      user.changePassword(await this.hasher.hash(newPassword));
      await this.users.update(user);
      await this.refreshTokens.revokeAllForUser(user.id);

      await this.audit.record({
        actorId: user.id,
        actorType: "user",
        action: "user.password_reset",
        resourceType: "user",
        resourceId: user.id,
      });
      await this.events.publish(userPasswordReset({ userId: user.id }));
    });
  }

  async verifyEmail(token: string): Promise<void> {
    await this.uow.transaction(async () => {
      const userId = await this.verificationTokens.consume(token, "email_verification");
      if (!userId) {
        throw ValidationError(
          "identity.invalid_verification_token",
          "This verification link is invalid or has expired.",
        );
      }
      const user = await this.users.findById(userId);
      if (!user) return;
      if (user.isEmailVerified) return;

      user.markEmailVerified(this.clock.now());
      await this.users.update(user);

      await this.audit.record({
        actorId: user.id,
        actorType: "user",
        action: "user.email_verified",
        resourceType: "user",
        resourceId: user.id,
      });
      await this.events.publish(userEmailVerified({ userId: user.id, email: user.email }));
    });
  }

  async requestEmailVerification(email: string): Promise<void> {
    await this.uow.transaction(async () => {
      const user = await this.users.findByEmail(email);
      if (!user || user.isEmailVerified) return;
      const token = await this.verificationTokens.issue({
        userId: user.id,
        purpose: "email_verification",
        ttlSeconds: EMAIL_VERIFICATION_TTL_SECONDS,
      });
      await this.events.publish(
        emailVerificationRequested({ userId: user.id, email: user.email, token, locale: user.locale }),
      );
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    organizationId: string | null,
    userAgent: string | null,
  ): Promise<TokenPair> {
    // permissionsFor reads the active tenant from context; `withContext` in the
    // caller has already pinned it, so this resolves the user's perms *in
    // `organizationId`* (empty for an orgless session).
    const perms = organizationId ? await this.permissions.permissionsFor(userId) : [];
    const accessToken = this.jwt.signAccessToken({ sub: userId, email, org: organizationId, perms });
    const { token: refreshToken, hash } = this.jwt.newRefreshToken();
    await this.refreshTokens.create({
      userId,
      tokenHash: hash,
      expiresAt: new Date(this.clock.now().getTime() + this.config.refreshTokenTtl * 1000),
      userAgent,
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.accessTokenTtl,
      tokenType: "Bearer",
    };
  }
}
