import type { EventCard as EventCardData } from "@/api/types";

export type Sort = "soonest" | "price-asc" | "price-desc";

/** Pure so it can be tested: filter by text and category, then sort. */
export function filterEvents(
  events: EventCardData[],
  opts: { q: string; category: string; sort: Sort },
): EventCardData[] {
  const q = opts.q.trim().toLowerCase();
  const out = events.filter(
    (e) =>
      (!opts.category || e.category === opts.category) &&
      (!q || `${e.title} ${e.venue.name} ${e.venue.area} ${e.category}`.toLowerCase().includes(q)),
  );
  const price = (e: EventCardData) => e.minPriceMinor ?? Number.MAX_SAFE_INTEGER;
  if (opts.sort === "price-asc") out.sort((a, b) => price(a) - price(b));
  else if (opts.sort === "price-desc")
    out.sort((a, b) => (b.minPriceMinor ?? -1) - (a.minPriceMinor ?? -1));
  else out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return out;
}
