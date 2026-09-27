import { useEffect, type ReactNode } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import "lenis/dist/lenis.css";

const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Leaves a little air above a section when a link lands on it.
const ANCHOR_OFFSET = -16;

/**
 * Makes every in-page `#anchor` link glide instead of jump. Lenis's built-in `anchors` option
 * doesn't cancel the browser's default jump, so the click is taken over here.
 */
function AnchorLinks() {
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      const hash = link?.getAttribute("href");
      if (!hash) return;
      const target = hash === "#" ? null : document.querySelector<HTMLElement>(hash);
      if (hash !== "#" && !target) return;
      e.preventDefault();
      lenis.scrollTo(target ?? 0, { offset: ANCHOR_OFFSET });
      if (hash !== "#") history.pushState(null, "", hash);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [lenis]);
  return null;
}

/**
 * Arriving on a URL with a hash (e.g. "/#rooms" from the 404 page): the browser tries to jump
 * before React has rendered the section, so jump once it exists.
 */
function InitialHash() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash === "#") return;
    const id = decodeURIComponent(hash.slice(1));
    const jump = () => document.getElementById(id)?.scrollIntoView({ block: "start" });
    // The page is rendered by now; jump again once web fonts settle, since they change text heights.
    jump();
    let cancelled = false;
    void document.fonts?.ready.then(() => !cancelled && jump());
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

/**
 * Eased, inertial page scrolling (Lenis) for the wheel, trackpad and in-page links.
 * Skipped entirely for users who ask the OS for reduced motion — they get native scrolling.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  if (prefersReducedMotion)
    return (
      <>
        <InitialHash />
        {children}
      </>
    );
  return (
    <ReactLenis root options={{ lerp: 0.09, autoRaf: true }}>
      <InitialHash />
      <AnchorLinks />
      {children}
    </ReactLenis>
  );
}
