import { describe, expect, it } from "vitest";
import { normalizePhone, validateDetails, validateProof, validEmail, validPhone, validTxn } from "./validation";

const ok = { name: "Nour Hassan", email: "nour@example.com", phone: "010 1234 5678", holders: ["Nour Hassan"], namedTickets: true, hasPolicies: true, policyAck: true };

describe("customer validation", () => {
  it("accepts a complete, valid form", () => {
    expect(validateDetails(ok)).toEqual({});
  });

  it("normalizes Egyptian mobile numbers", () => {
    expect(normalizePhone("+20 10 1234 5678")).toBe("01012345678");
    expect(normalizePhone("0020-10-1234-5678")).toBe("01012345678");
    expect(validPhone("011 5550 7781")).toBe(true);
    expect(validPhone("010 1234 567")).toBe(false); // 10 digits
    expect(validPhone("013 1234 5678")).toBe(false); // 013 is not a mobile prefix
  });

  it("explains each problem with an actionable message", () => {
    const e = validateDetails({ ...ok, name: "X", email: "nope", phone: "010 12", holders: ["Nour", ""], policyAck: false });
    expect(e.name).toMatch(/full name/);
    expect(e.email).toMatch(/name@example.com/);
    expect(e.phone).toMatch(/11 digits/);
    expect(e["holder-1"]).toBe("Add a name for ticket 2.");
    expect(e["holder-0"]).toBeUndefined();
    expect(e.policy).toMatch(/policies/);
  });

  it("only requires holder names when the event names its tickets, and the policy tick only when there are policies", () => {
    expect(validateDetails({ ...ok, namedTickets: false, holders: ["", ""], hasPolicies: false, policyAck: false })).toEqual({});
  });

  it("checks email shape", () => {
    expect(validEmail("a@b.co")).toBe(true);
    expect(validEmail("a@b")).toBe(false);
  });

  it("holds proof files to type and size rules", () => {
    expect(validateProof({ name: "r.png", type: "image/png", size: 1000 })).toBeNull();
    expect(validateProof({ name: "r.heic", type: "", size: 1000 })).toBeNull();
    expect(validateProof({ name: "r.exe", type: "application/x-msdownload", size: 1000 })).toMatch(/photo/);
    expect(validateProof({ name: "r.png", type: "image/png", size: 14 * 1024 * 1024 })).toBe("This file is 14 MB. Upload one under 10 MB.");
  });

  it("treats the transaction id as optional but 4-40 characters when given", () => {
    expect(validTxn("")).toBe(true);
    expect(validTxn("123")).toBe(false);
    expect(validTxn("4829 1150 33")).toBe(true);
  });
});
