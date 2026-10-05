import { C } from "./colors";

/** Segmented-control button style. */
export function seg(cur: string, val: string, label: string, set: () => void, dark = false) {
  const on = cur === val;
  return {
    label,
    set,
    bg: on ? (dark ? C.brand.onDark : C.text.ink) : dark ? "transparent" : C.surface.white,
    fg: on ? (dark ? C.chrome.bgDeep : C.surface.white) : dark ? C.chrome.textMuted : C.text.body,
  };
}
