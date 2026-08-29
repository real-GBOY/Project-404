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
});
