import { describe, expect, it } from "vitest";
import { UserEntity } from "../domain/user.js";

describe("UserEntity", () => {
  it("starts PENDING when verification is required", () => {
    const u = UserEntity.register({
      id: "usr_1",
      email: "  Test@Example.com ",
      passwordHash: "h",
      requireVerification: true,
    });
    expect(u.status).toBe("pending");
    expect(u.canLogIn).toBe(false);
    expect(u.email).toBe("Test@Example.com");
    expect(u.emailNormalized).toBe("test@example.com");
  });

  it("starts ACTIVE when verification is not required", () => {
    const u = UserEntity.register({
      id: "usr_2",
      email: "a@b.com",
      passwordHash: "h",
      requireVerification: false,
    });
    expect(u.status).toBe("active");
    expect(u.canLogIn).toBe(true);
  });

  it("activates a pending user when the email is verified", () => {
    const u = UserEntity.register({
      id: "usr_3",
      email: "a@b.com",
      passwordHash: "h",
      requireVerification: true,
    });
    u.markEmailVerified(new Date());
    expect(u.isEmailVerified).toBe(true);
    expect(u.status).toBe("active");
  });

  it("disabling blocks login even after verification", () => {
    const u = UserEntity.register({
      id: "usr_4",
      email: "a@b.com",
      passwordHash: "h",
      requireVerification: false,
    });
    u.disable();
    expect(u.canLogIn).toBe(false);
  });

  it("verifying does not resurrect a disabled account", () => {
    const u = UserEntity.register({
      id: "usr_5",
      email: "a@b.com",
      passwordHash: "h",
      requireVerification: true,
    });
    u.disable();
    u.markEmailVerified(new Date());
    expect(u.isEmailVerified).toBe(true);
    expect(u.status).toBe("disabled");
    expect(u.canLogIn).toBe(false);
  });

  it("normalizeEmail lower-cases and trims", () => {
    expect(UserEntity.normalizeEmail("  MixedCase@Example.COM ")).toBe("mixedcase@example.com");
  });

  it("changePassword swaps the stored hash only", () => {
    const u = UserEntity.register({
      id: "usr_6",
      email: "a@b.com",
      passwordHash: "old",
      requireVerification: false,
    });
    u.changePassword("new");
    expect(u.passwordHash).toBe("new");
    expect(u.status).toBe("active");
  });

  it("toPublic exposes the safe fields and never the hash", () => {
    const u = UserEntity.register({
      id: "usr_7",
      email: "user@b.com",
      passwordHash: "secret-hash",
      displayName: "User",
      locale: "ar",
      requireVerification: true,
    });
    const pub = u.toPublic();
    expect(pub).toEqual({
      id: "usr_7",
      email: "user@b.com",
      displayName: "User",
      status: "pending",
      emailVerified: false,
      locale: "ar",
    });
    expect(JSON.stringify(pub)).not.toContain("secret-hash");
  });

  it("rehydrate restores an entity from a snapshot without transitions", () => {
    const u = UserEntity.rehydrate({
      id: "usr_8",
      email: "a@b.com",
      emailNormalized: "a@b.com",
      passwordHash: "h",
      displayName: null,
      status: "active",
      emailVerifiedAt: new Date("2026-01-01T00:00:00Z"),
      locale: null,
    });
    expect(u.canLogIn).toBe(true);
    expect(u.isEmailVerified).toBe(true);
  });
});
