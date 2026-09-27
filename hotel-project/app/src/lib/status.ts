/**
 * Status → tone, copied from the HotelOS design's `statusStyle()` map so every badge in the app
 * uses the same colour for the same meaning. Tones map to the palette in `styles/colors.ts`.
 */
export type Tone = "success" | "warning" | "danger" | "info" | "primary" | "neutral";

const TONES: Record<string, Tone> = {
  available: "success",
  paid: "success",
  checked_out: "success",
  resolved: "success",
  verified: "success",
  active: "success",
  clean: "success",
  inspected: "success",
  in_service: "success",

  reserved: "warning",
  pending: "warning",
  partial: "warning",
  open: "warning",
  medium: "warning",

  assigned: "info",
  confirmed: "info",
  cleaning: "info",

  occupied: "primary",
  checked_in: "primary",
  in_progress: "primary",

  dirty: "danger",
  cancelled: "danger",
  no_show: "danger",
  failed: "danger",
  high: "danger",
  maintenance: "danger",

  out_of_service: "neutral",
  low: "neutral",
  refunded: "neutral",
  disabled: "neutral",
};

export function toneFor(status: string): Tone {
  return TONES[status] ?? "neutral";
}

/** "out_of_service" → "Out Of Service" (the design's `label()`). */
export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}
