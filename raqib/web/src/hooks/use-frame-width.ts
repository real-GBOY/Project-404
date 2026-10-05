import { useEffect, useRef } from "react";
import { setUi } from "@/state/ui-store";

/**
 * Measure the app frame, not the window, so the layout reacts to the real available width. Returns the ref to put on the
 * frame; the width lands in UI state (`ui.w`), which presenters read to pick the mobile or desktop layout.
 */
export function useFrameWidth() {
  const frame = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]!.contentRect.width);
      setUi((s) => (Math.abs(w - s.w) > 2 ? { w } : {}));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return frame;
}
