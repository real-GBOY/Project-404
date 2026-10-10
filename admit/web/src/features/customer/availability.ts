import type { EventCard as EventCardData } from "@/api/types";

export function availabilityText(a: EventCardData["availability"]): { text: string; cls: string } {
  switch (a) {
    case "sold_out":
      return { text: "Sold out", cls: "text-off-fg" };
    case "selling_fast":
      return { text: "Selling fast", cls: "text-used-fg" };
    case "ended":
      return { text: "Ended", cls: "text-off-fg" };
    default:
      return { text: "On sale", cls: "text-ink-2" };
  }
}
