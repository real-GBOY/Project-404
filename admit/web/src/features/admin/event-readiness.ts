import type { AdminEvent, Venue } from "@/api/types";

interface DraftLike {
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  venueId: string;
}

export interface Readiness {
  ok: boolean;
  checks: { label: string; ok: boolean }[];
  sections: { id: string; label: string; ok: boolean }[];
}

/**
 * "Ready to publish?" - the same rules the server enforces on publish, computed from what is on screen so the person sees every
 * blocker at once. The server still decides: publishing re-checks everything.
 */
export function readiness(
  d: DraftLike,
  event: AdminEvent | undefined,
  venue: Venue | undefined,
  now = new Date(),
): Readiness {
  const types = event?.ticketTypes.filter((t) => t.onSale && t.quantity > 0) ?? [];
  const allocated = event?.capacityAllocated ?? 0;
  const windowOk = !!d.startsAt && !!d.endsAt && new Date(d.endsAt) > new Date(d.startsAt);
  const future = windowOk && new Date(d.endsAt) > now;
  const checks = [
    { label: "Name and public address", ok: d.title.trim().length >= 2 && d.slug.length >= 3 },
    {
      label: windowOk
        ? "Ends after it starts, in the future"
        : "End time is before start (or not set)",
      ok: future,
    },
    { label: "A venue is chosen", ok: !!venue },
    {
      label: `${types.length} ticket type${types.length === 1 ? "" : "s"} on sale`,
      ok: types.length > 0,
    },
    {
      label:
        venue && allocated > venue.capacity
          ? `Tickets exceed venue capacity by ${allocated - venue.capacity}`
          : "Ticket quantities fit the venue",
      ok: !!venue && allocated <= venue.capacity,
    },
    {
      label: "A payment method with recipient details",
      ok: !!event?.paymentMethods.some((m) => m.enabled),
    },
  ];
  const by = (i: number[]) => i.every((n) => checks[n]!.ok);
  return {
    ok: checks.every((c) => c.ok),
    checks,
    sections: [
      { id: "basic", label: "Basic info", ok: by([0]) },
      { id: "when", label: "Date & venue", ok: by([1, 2]) },
      { id: "tickets", label: "Tickets & pricing", ok: by([3, 4]) },
      { id: "methods", label: "Payment methods", ok: by([5]) },
      { id: "policies", label: "Policies", ok: true },
    ],
  };
}
