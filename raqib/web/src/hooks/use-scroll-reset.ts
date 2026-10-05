import { useEffect, useRef } from "react";

/** A scroll container that jumps back to the top whenever `key` (the route) changes. */
export function useScrollReset(key: string) {
  const scroller = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [key]);
  return scroller;
}
