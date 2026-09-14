import { useEffect, useState } from "react";

export interface FeedSeedItem {
  text: string;
  who: string;
  color: string;
}

export interface FeedItem extends FeedSeedItem {
  id: string;
  when: string;
}

/**
 * Demonstrates the design's "Live Activity" streaming UX without a real
 * backend: periodically promotes the next item from a fixed seed pool to the
 * top of the list with a fresh "just now" timestamp, capped at `max` items —
 * deterministic content, cosmetic timing only (PLAN §16).
 */
export function useSimulatedFeed(seed: FeedSeedItem[], initial: { when: string }[], max = 10, intervalMs = 7000): FeedItem[] {
  const [items, setItems] = useState<FeedItem[]>(() =>
    seed.slice(0, max).map((s, i) => ({ ...s, id: `seed_${i}`, when: initial[i]?.when ?? s.who })),
  );

  useEffect(() => {
    let cursor = 0;
    const id = setInterval(() => {
      const next = seed[cursor % seed.length];
      cursor += 1;
      setItems((prev) => [{ ...next, id: `live_${Date.now()}`, when: "just now" }, ...prev].slice(0, max));
    }, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return items;
}
