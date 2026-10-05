import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, newRecoveryCodes, newSecret, otpauthUri, verifyTotp } from "./totp.js";

// RFC 4226 appendix D / RFC 6238 appendix B use the ASCII secret "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("matches the RFC 4226 HOTP test vectors", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, counter) => expect(hotp(RFC_SECRET, counter)).toBe(code));
  });

  it("matches an RFC 6238 time vector (SHA-1, 59 s → 94287082 → 287082)", () => {
    expect(verifyTotp(RFC_SECRET, "287082", new Date(59_000))).toBe(1);
  });

  it("accepts one step of clock drift either way but not more", () => {
    const at = new Date(1_000_000 * 30_000);
    const code = hotp(RFC_SECRET, 1_000_000);
    expect(verifyTotp(RFC_SECRET, code, new Date(at.getTime() + 30_000))).toBe(1_000_000);
    expect(verifyTotp(RFC_SECRET, code, new Date(at.getTime() - 30_000))).toBe(1_000_000);
    expect(verifyTotp(RFC_SECRET, code, new Date(at.getTime() + 90_000))).toBeNull();
  });

  it("refuses to accept the same step twice", () => {
    const at = new Date(1_000_000 * 30_000);
    const code = hotp(RFC_SECRET, 1_000_000);
    expect(verifyTotp(RFC_SECRET, code, at, 1_000_000)).toBeNull();
    expect(verifyTotp(RFC_SECRET, code, at, 999_999)).toBe(1_000_000);
  });

  it("rejects malformed codes", () => {
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 5x"]) expect(verifyTotp(RFC_SECRET, bad, new Date())).toBeNull();
  });

  it("round-trips base32 and makes provisioning URIs and recovery codes", () => {
    const s = newSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
    expect(otpauthUri(s, "a@b.example", "Raqib")).toMatch(/^otpauth:\/\/totp\/Raqib%3Aa%40b\.example\?secret=[A-Z2-7]+&issuer=Raqib/);
    const codes = newRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    codes.forEach((c) => expect(c).toMatch(/^[a-z2-7]{4}-[a-z2-7]{4}$/));
  });
});
