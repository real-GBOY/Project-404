import { describe, expect, it } from "vitest";
import type { GuestBooking } from "@/api/types";
import { buildSteps } from "./status-steps";

const base: GuestBooking = {
  ref: "ADM-AAAA-BBBB",
  status: "AWAITING_PAYMENT",
  event: {
    id: "e",
    slug: "s",
    title: "T",
    startsAt: "2026-11-14T18:00:00Z",
    endsAt: "2026-11-14T22:00:00Z",
    venue: { name: "V", area: "", address: "", mapUrl: null },
    coverUrl: null,
    namedTickets: false,
  },
  customer: { name: "N", emailMasked: "n***@example.com" },
  lines: [],
  totalMinor: 100,
  currency: "EGP",
  holdExpiresAt: "2026-11-08T16:40:00Z",
  rejectionReason: null,
  canResubmit: true,
  paymentMethods: [],
  timeline: [{ step: "Booking created", state: "done", at: "2026-11-07T16:40:00Z", note: null }],
  ticketCount: 0,
  emailStatus: null,
};
const states = (b: GuestBooking) => buildSteps(b).map((s) => s.state);

describe("booking timeline", () => {
  it("waits on the customer while awaiting payment", () => {
    expect(states(base)).toEqual(["done", "act", "todo", "todo", "todo"]);
  });

  it("shows review as in progress and nothing after it as done", () => {
    expect(states({ ...base, status: "IN_REVIEW" })).toEqual([
      "done",
      "done",
      "now",
      "todo",
      "todo",
    ]);
  });

  it("never marks tickets emailed before the server reports the email accepted", () => {
    const confirmed = { ...base, status: "CONFIRMED" as const, ticketCount: 2 };
    expect(states({ ...confirmed, emailStatus: "QUEUED" })).toEqual([
      "done",
      "done",
      "done",
      "done",
      "now",
    ]);
    expect(states({ ...confirmed, emailStatus: "RETRYING" })).toEqual([
      "done",
      "done",
      "done",
      "done",
      "now",
    ]);
    expect(states({ ...confirmed, emailStatus: "ACCEPTED" })).toEqual([
      "done",
      "done",
      "done",
      "done",
      "done",
    ]);
    const failed = buildSteps({ ...confirmed, emailStatus: "FAILED" });
    expect(failed[4]).toMatchObject({ state: "fail" });
    expect(failed[3]!.state).toBe("done"); // a failed email never un-issues tickets
  });

  it("explains a rejected proof that can be fixed", () => {
    const s = buildSteps({
      ...base,
      rejectionReason: "short",
      timeline: [
        ...base.timeline,
        { step: "Payment rejected", state: "failed", at: "2026-11-07T18:31:00Z", note: "short" },
      ],
    });
    expect(s[1]).toMatchObject({ state: "fail", label: "Proof not accepted" });
    expect(s[2]).toMatchObject({ state: "act" });
  });

  it("marks expiry and cancellation as failures at the step they stopped", () => {
    expect(states({ ...base, status: "EXPIRED" })).toEqual([
      "done",
      "fail",
      "todo",
      "todo",
      "todo",
    ]);
    expect(states({ ...base, status: "CANCELLED" })).toEqual([
      "done",
      "fail",
      "todo",
      "todo",
      "todo",
    ]);
  });
});
