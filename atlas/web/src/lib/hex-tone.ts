import type { Tone } from "./tone";
import { TOKEN_COLORS } from "@/styles/colors";

/** Fixtures sometimes carry raw hex (tagFg/deltaFg) rather than a status string; map back to a Tone. */
const HEX_TONE: Record<string, Tone> = {
  [TOKEN_COLORS.success.success.toUpperCase()]: "success",
  [TOKEN_COLORS.brand.primary.toUpperCase()]: "brand",
  [TOKEN_COLORS.danger.danger.toUpperCase()]: "danger",
  [TOKEN_COLORS.warning.warning.toUpperCase()]: "warning",
  [TOKEN_COLORS.info.info.toUpperCase()]: "info",
  [TOKEN_COLORS.neutral.neutralTone.toUpperCase()]: "neutral",
  [TOKEN_COLORS.text.muted.toUpperCase()]: "muted",
};

export function toneFromHex(hex: string): Tone {
  return HEX_TONE[hex.toUpperCase()] ?? "muted";
}

export function deltaSignFromHex(hex: string): "up" | "down" | "flat" {
  const upper = hex.toUpperCase();
  if (upper === TOKEN_COLORS.success.success.toUpperCase()) return "up";
  if (upper === TOKEN_COLORS.danger.danger.toUpperCase()) return "down";
  return "flat";
}
