import type { Tone } from "./tone";

/** Fixtures sometimes carry raw hex (tagFg/deltaFg) rather than a status string; map back to a Tone. */
const HEX_TONE: Record<string, Tone> = {
  "#1E7A5A": "success",
  "#1B4DB8": "brand",
  "#9A3838": "danger",
  "#8A6120": "warning",
  "#3A5FA8": "info",
  "#6E6459": "neutral",
  "#8A8A85": "muted",
};

export function toneFromHex(hex: string): Tone {
  return HEX_TONE[hex.toUpperCase()] ?? "muted";
}

export function deltaSignFromHex(hex: string): "up" | "down" | "flat" {
  if (hex.toUpperCase() === "#1E7A5A") return "up";
  if (hex.toUpperCase() === "#9A3838") return "down";
  return "flat";
}
