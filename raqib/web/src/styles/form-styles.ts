import type { CSSProperties } from "react";
import { C } from "./colors";

/**
 * Style building blocks for the hand-written screens (sign-in, account, public pages, status bars). The approved design
 * screens carry their own inline styles; these are the same tokens (palette, radii) for everything written by hand, defined
 * once so no screen re-declares a card, an input or a button.
 */
export const FORM = {
  card: {
    background: C.surface.white,
    border: `1px solid ${C.border.hairline}`,
    borderRadius: 6,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  input: {
    height: 42,
    border: `1px solid ${C.border.input}`,
    borderRadius: 4,
    padding: "0 12px",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  },
  label: { display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 500 },
  hint: { fontWeight: 400, color: C.text.secondary },
  heading: { margin: 0, fontSize: 18, fontWeight: 600 },
  sectionHeading: { margin: 0, fontSize: 16, fontWeight: 600 },
  primaryButton: {
    height: 42,
    border: 0,
    borderRadius: 4,
    background: C.brand.primary,
    color: C.surface.white,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    padding: "0 18px",
  },
  ghostButton: {
    height: 36,
    border: `1px solid ${C.border.input}`,
    borderRadius: 4,
    background: C.surface.white,
    color: C.text.ink,
    fontSize: 13,
    cursor: "pointer",
    padding: "0 14px",
  },
  link: { fontSize: 13, color: C.brand.primary, textAlign: "center" },
  /** a small outlined button on the dark chrome bars (account bar, presenter bar) */
  barButton: {
    height: 24,
    padding: "0 10px",
    border: `1px solid ${C.chrome.line}`,
    borderRadius: 4,
    fontSize: 12,
    cursor: "pointer",
    color: C.brand.onDark,
    background: "transparent",
  },
} satisfies Record<string, CSSProperties>;
