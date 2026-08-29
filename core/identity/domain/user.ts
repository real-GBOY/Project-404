import type { User as PublicUser } from "../../contracts/index.js";

/**
 * The Employee-vs-Order lifecycle in the plan (§3.4) applies here too: the
 * domain decides a new user's initial status and what a valid transition is.
 * It knows nothing about SQL, HTTP, or JWT.
 */
export type UserStatus = "active" | "pending" | "disabled";

export interface UserProps {
  id: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  displayName: string | null;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  locale: string | null;
}

export class UserEntity {
  private constructor(private props: UserProps) {}

  static rehydrate(props: UserProps): UserEntity {
    return new UserEntity(props);
  }

  /**
   * A newly registered user is PENDING until they verify their email.
   * `requireVerification: false` (e.g. admin-created accounts) starts ACTIVE.
   */
  static register(input: {
    id: string;
    email: string;
    passwordHash: string;
    displayName?: string | null;
    locale?: string | null;
    requireVerification: boolean;
  }): UserEntity {
    return new UserEntity({
      id: input.id,
      email: input.email.trim(),
      emailNormalized: UserEntity.normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      displayName: input.displayName ?? null,
      status: input.requireVerification ? "pending" : "active",
      emailVerifiedAt: null,
      locale: input.locale ?? null,
    });
  }

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get emailNormalized(): string {
    return this.props.emailNormalized;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get status(): UserStatus {
    return this.props.status;
  }
  get locale(): string | null {
    return this.props.locale;
  }
  get isEmailVerified(): boolean {
    return this.props.emailVerifiedAt !== null;
  }
  get canLogIn(): boolean {
    return this.props.status === "active";
  }

  markEmailVerified(at: Date): void {
    this.props.emailVerifiedAt = at;
    if (this.props.status === "pending") this.props.status = "active";
  }

  changePassword(newHash: string): void {
    this.props.passwordHash = newHash;
  }

  disable(): void {
    this.props.status = "disabled";
  }

  toSnapshot(): UserProps {
    return { ...this.props };
  }

  toPublic(): PublicUser {
    return {
      id: this.props.id,
      email: this.props.email,
      displayName: this.props.displayName,
      status: this.props.status,
      emailVerified: this.isEmailVerified,
      locale: this.props.locale,
    };
  }
}
