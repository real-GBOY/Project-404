import { useEffect, useRef } from "react";
import type { AuthStatus } from "./auth-context";

const CHECK_MS = 15_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/**
 * The organization's inactivity rule (settings → security → session, minutes): with no activity for that long the person is
 * signed out. A value of 0 switches the rule off.
 */
export function useIdleSignout(status: AuthStatus, idleMinutes: number, signOut: () => void): void {
  const lastActive = useRef(Date.now());
  useEffect(() => {
    if (status !== "authenticated" || idleMinutes <= 0) return;
    lastActive.current = Date.now();
    const touch = () => {
      lastActive.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - lastActive.current > idleMinutes * 60_000) signOut();
    }, CHECK_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
    };
  }, [status, idleMinutes, signOut]);
}
