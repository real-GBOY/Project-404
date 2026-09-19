import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import { IdentityService } from "@core/identity/application/identity-service.js";
import { UNKNOWN_USER_NAME, UserDirectory } from "@core/identity/application/user-directory.js";
import { createTestCore, get, hasTestDb } from "@core/tests/helpers.js";

const suite = hasTestDb ? describe : describe.skip;

suite("core/identity — UserDirectory wired through IdentityModule", () => {
  let core: TestingModule;
  beforeAll(async () => {
    core = await createTestCore({ requireEmailVerification: false });
  }, 60_000);
  afterAll(async () => {
    await core?.close();
  });

  it("is provided by Core's IdentityModule and resolves real users through the USER_PROVIDER contract", async () => {
    const ids = get<IdentityService>(core, IdentityService);
    const named = await ids.register({ email: `named+${Date.now()}@t.test`, password: "correct horse battery", displayName: "Nadia Named" });
    const bare = await ids.register({ email: `bare+${Date.now()}@t.test`, password: "correct horse battery" });

    const dir = get<UserDirectory>(core, UserDirectory);
    expect(await dir.userName(named.id)).toBe("Nadia Named");
    expect(await dir.userName(bare.id)).toBe(bare.email); // no display name → email
    expect(await dir.userName("usr_does_not_exist")).toBe(UNKNOWN_USER_NAME);
    expect(Object.fromEntries(await dir.userNames([named.id, bare.id, named.id]))).toEqual({
      [named.id]: "Nadia Named",
      [bare.id]: bare.email,
    });
  });

  it("is a singleton across the app: every consumer shares the one provider instance", () => {
    expect(get<UserDirectory>(core, UserDirectory)).toBe(get<UserDirectory>(core, UserDirectory));
  });
});
