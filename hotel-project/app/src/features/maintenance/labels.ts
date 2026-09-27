import { statusLabel } from "@/lib/status";

export { formatIsoDate } from "@/lib/format";

/** "out_of_service" → "Out Of Service"; empty → "—". */
export function statusLabelOrDash(value: string | null | undefined): string {
  return value ? statusLabel(value) : "—";
}

export const IMPACT_HINT: Record<string, string> = {
  none: "The room stays on sale.",
  maintenance: "Under maintenance — not sold until the repair is verified.",
  out_of_service: "Out of service — not sold until the repair is verified.",
};

export const EVENT_LABEL: Record<string, string> = {
  reported: "Reported",
  assigned: "Assigned",
  started: "Work started",
  note: "Note",
  cost: "Cost updated",
  resolved: "Resolved",
  reopened: "Reopened",
  verified: "Verified — back in service",
  block_extended: "Block extended",
};
