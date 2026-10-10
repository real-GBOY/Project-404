import { describe, expect, it } from "vitest";
import type { AdminEvent, Venue } from "@/api/types";
import { readiness } from "./event-readiness";

const venue: Venue = { id: "v", name: "Hall", area: "", address: "", mapUrl: null, capacity: 100 };
const event = (over: Partial<AdminEvent> = {}): AdminEvent =>
  ({
    id: "e",
    capacityAllocated: 60,
    ticketTypes: [{ id: "t", onSale: true, quantity: 60 }],
    paymentMethods: [{ id: "m", enabled: true }],
    ...over,
  }) as unknown as AdminEvent;
const draft = {
  title: "Jazz",
  slug: "jazz",
  startsAt: "2026-12-01T18:00:00Z",
  endsAt: "2026-12-01T22:00:00Z",
  venueId: "v",
};
const now = new Date("2026-11-01T00:00:00Z");

describe("event readiness", () => {
  it("passes when everything the server checks is in place", () => {
    const r = readiness(draft, event(), venue, now);
    expect(r.ok).toBe(true);
    expect(r.sections.every((s) => s.ok)).toBe(true);
  });
  it("names every blocker at once", () => {
    const r = readiness(
      { ...draft, endsAt: "2026-12-01T10:00:00Z" },
      event({ ticketTypes: [], paymentMethods: [], capacityAllocated: 0 }),
      venue,
      now,
    );
    expect(r.ok).toBe(false);
    expect(r.checks.filter((c) => !c.ok).map((c) => c.label)).toEqual(
      expect.arrayContaining([
        "End time is before start (or not set)",
        "0 ticket types on sale",
        "A payment method with recipient details",
      ]),
    );
    expect(r.sections.find((s) => s.id === "when")!.ok).toBe(false);
  });
  it("flags capacity overruns with the amount", () => {
    const r = readiness(draft, event({ capacityAllocated: 120 }), venue, now);
    expect(r.checks.find((c) => !c.ok)!.label).toBe("Tickets exceed venue capacity by 20");
  });
  it("treats a disabled payment method as no method", () => {
    expect(
      readiness(draft, event({ paymentMethods: [{ enabled: false }] as never }), venue, now).ok,
    ).toBe(false);
  });
});
