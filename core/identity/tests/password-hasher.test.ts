import { describe, expect, it } from "vitest";
import argon2 from "argon2";
import { argon2Hasher } from "../infrastructure/password-hasher.js";

describe("argon2Hasher", () => {
  it("produces an argon2id PHC string", async () => {
    const hash = await argon2Hasher.hash("correct horse battery staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("salts — the same password hashes differently each time", async () => {
    const a = await argon2Hasher.hash("same-password");
    const b = await argon2Hasher.hash("same-password");
    expect(a).not.toBe(b);
  });

  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await argon2Hasher.hash("s3cret-passphrase");
    expect(await argon2Hasher.verify(hash, "s3cret-passphrase")).toBe(true);
    expect(await argon2Hasher.verify(hash, "not-it")).toBe(false);
  });

  it("returns false (never throws) for a malformed hash", async () => {
    expect(await argon2Hasher.verify("not-a-hash", "whatever")).toBe(false);
  });

  it("does not ask to rehash a hash it just produced", async () => {
    const hash = await argon2Hasher.hash("fresh");
    expect(argon2Hasher.needsRehash(hash)).toBe(false);
  });

  it("asks to rehash a hash made with weaker parameters", async () => {
    // a genuine argon2id hash below the current memory/time policy
    const weak = await argon2.hash("legacy", {
      type: argon2.argon2id,
      memoryCost: 8192, // below the current 19,456 policy
      timeCost: 2,
      parallelism: 1,
    });
    expect(argon2Hasher.needsRehash(weak)).toBe(true);
  });
});
