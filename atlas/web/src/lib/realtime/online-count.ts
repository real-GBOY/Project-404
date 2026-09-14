import { useSyncExternalStore } from "react";

/**
 * Simulated live-presence count (header "Live · N online" pill). A module-level
 * singleton so every subscriber (TopBar, Dashboard) reads the same value
 * without needing a provider — this is cosmetic realtime, not real state.
 */
let count = 12;
const listeners = new Set<() => void>();

function tick() {
  const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
  count = Math.min(24, Math.max(6, count + delta));
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  setInterval(tick, 4500);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): number {
  return count;
}

export function useOnlineCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
