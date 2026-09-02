import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "@/test/msw/server";
import { initI18n } from "@/lib/i18n";
import { tokenStore } from "@/lib/auth/token-store";
import { sessionCache } from "@/lib/auth/session-cache";
import { resetDb } from "@/test/msw/fixtures/db";

/*
 * Neutralise @floating-ui/react-dom (Radix Popper: Popover, DropdownMenu, Select,
 * Tooltip). Under jsdom its position measurement re-runs on every React flush and
 * its autoUpdate listeners accumulate across a file — tens of seconds per test
 * and eventually a `vitest-worker onTaskUpdate` timeout. Overlay CONTENT still
 * renders (Radix mounts it regardless of coordinates), so open/select behaviour
 * is fully testable; only the pixel position is faked.
 */
vi.mock("@floating-ui/react-dom", () => {
  const inertMiddleware = (name: string) => ({ name, options: {}, fn: () => ({}) });
  return {
    useFloating: () => ({
      x: 0,
      y: 0,
      strategy: "fixed" as const,
      placement: "bottom" as const,
      isPositioned: true,
      middlewareData: {},
      floatingStyles: { position: "fixed" as const, left: 0, top: 0, transform: "translate(0px, 0px)" },
      elements: {},
      context: {},
      update: () => {},
      refs: {
        setReference: () => {},
        setFloating: () => {},
        reference: { current: null },
        floating: { current: null },
      },
    }),
    autoUpdate: () => () => {},
    computePosition: () =>
      Promise.resolve({ x: 0, y: 0, placement: "bottom", strategy: "fixed", middlewareData: {} }),
    detectOverflow: () => ({}),
    getOverflowAncestors: () => [],
    platform: {},
    offset: () => inertMiddleware("offset"),
    shift: () => inertMiddleware("shift"),
    limitShift: () => inertMiddleware("limitShift"),
    flip: () => inertMiddleware("flip"),
    size: () => inertMiddleware("size"),
    hide: () => inertMiddleware("hide"),
    inline: () => inertMiddleware("inline"),
    autoPlacement: () => inertMiddleware("autoPlacement"),
    arrow: () => inertMiddleware("arrow"),
  };
});

await initI18n();

/*
 * jsdom gaps that Radix primitives (Select, Popover, DropdownMenu, Dialog) and
 * our menu components depend on. Without these, pointer-driven open/close never
 * fires and every interaction test burns its full timeout.
 */
if (!("PointerEvent" in globalThis)) {
  class MockPointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  Object.assign(globalThis, { PointerEvent: MockPointerEvent });
}

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture ??= vi.fn(() => false);
Element.prototype.setPointerCapture ??= vi.fn();
Element.prototype.releasePointerCapture ??= vi.fn();

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
  tokenStore.clear();
  sessionCache.clear();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});
afterAll(() => server.close());
