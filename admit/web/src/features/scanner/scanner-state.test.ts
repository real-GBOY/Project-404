import { describe, expect, it } from "vitest";
import { tokenFromScan } from "./scanner-state";
import type { ScanOutcome } from "@/api/types";
import {
  isCompleteTicketId,
  isDuplicateRead,
  normalizeTicketId,
  reduce,
  verdictKind,
  type Screen,
} from "./scanner-state";

const admitted: ScanOutcome = {
  result: "ADMITTED",
  ticket: { id: "TKT-AAAA-BBBB", holder: "Mona", type: "Entry" },
};
const read = { token: "x".repeat(22) };

describe("scanner state machine", () => {
  it("never shows a verdict without a server answer", () => {
    let s: Screen = reduce({ name: "home" }, { type: "start" });
    s = reduce(s, { type: "code_read", request: read });
    expect(s.name).toBe("checking");
    // an answer is the only way to a verdict
    expect(reduce(s, { type: "answered", outcome: admitted }).name).toBe("verdict");
    // no answer in time shows an error, never green
    const off = reduce(s, { type: "no_answer" });
    expect(off.name).toBe("offline");
  });

  it("ignores answers and reads that arrive in the wrong state", () => {
    const home: Screen = { name: "home" };
    expect(reduce(home, { type: "answered", outcome: admitted })).toBe(home);
    expect(reduce(home, { type: "code_read", request: read })).toBe(home);
    const verdict = reduce(
      reduce(reduce({ name: "scanning" }, { type: "code_read", request: read }), {
        type: "answered",
        outcome: admitted,
      }),
      { type: "code_read", request: { token: "y".repeat(22) } },
    );
    expect(verdict.name).toBe("verdict"); // a stray second read does not replace the verdict on screen
  });

  it("re-sends the SAME code on retry after a lost connection", () => {
    const checking = reduce({ name: "scanning" }, { type: "code_read", request: read });
    const off = reduce(checking, { type: "no_answer" });
    const again = reduce(off, { type: "retry" });
    expect(again).toEqual({ name: "checking", request: read });
  });

  it("de-duplicates the same code within three seconds only", () => {
    expect(isDuplicateRead({ code: "a", at: 1000 }, "a", 3500)).toBe(true);
    expect(isDuplicateRead({ code: "a", at: 1000 }, "a", 4100)).toBe(false);
    expect(isDuplicateRead({ code: "a", at: 1000 }, "b", 1500)).toBe(false);
    expect(isDuplicateRead(null, "a", 1)).toBe(false);
  });

  it("maps every server answer to one of the six verdict screens", () => {
    expect(verdictKind(admitted)).toBe("approved");
    expect(verdictKind({ result: "ALREADY_USED" })).toBe("used");
    expect(verdictKind({ result: "INVALID", reason: "unknown" })).toBe("unknown");
    expect(verdictKind({ result: "INVALID", reason: "revoked" })).toBe("revoked");
    expect(verdictKind({ result: "INVALID", reason: "other_event" })).toBe("other_event");
    expect(verdictKind({ result: "INVALID", reason: "event_closed" })).toBe("closed");
    expect(verdictKind({ result: "INVALID" })).toBe("unknown");
  });

  it("normalizes typed ticket IDs", () => {
    expect(normalizeTicketId("tkt 6plm w45e")).toBe("TKT-6PLM-W45E");
    expect(normalizeTicketId("6plmw45e")).toBe("TKT-6PLM-W45E");
    expect(isCompleteTicketId("tkt-6plm-w45e")).toBe(true);
    expect(isCompleteTicketId("tkt-6plm")).toBe(false);
    expect(isCompleteTicketId("TKT-OPLM-W45E")).toBe(false); // the letter O is never issued
  });
});

describe("QR link payloads", () => {
  const token = "aB3_-xyZ0123456789AbCd";
  it("extracts the token from the ticket link or a bare token", () => {
    expect(tokenFromScan(`https://admit.example/q/${token}`)).toBe(token);
    expect(tokenFromScan(`http://localhost:4700/q/${token}?x=1`)).toBe(token);
    expect(tokenFromScan(token)).toBe(token);
  });
  it("rejects anything that is not one of ours", () => {
    expect(tokenFromScan("https://example.com/other")).toBeNull();
    expect(tokenFromScan("hello")).toBeNull();
    expect(tokenFromScan(`https://admit.example/q/${token}extra`)).toBeNull();
  });
});
