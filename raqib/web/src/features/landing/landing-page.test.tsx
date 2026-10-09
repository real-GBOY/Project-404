import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it } from "vitest";
import { setUi } from "@/state/ui-store";
import { AR } from "./copy-ar";
import { EN } from "./copy-en";
import { LandingPage } from "./landing-page";

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
});

const show = () =>
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );

describe("landing page", () => {
  it("shows the headline in the interface language and sends every call to action to sign-in", () => {
    setUi({ lang: "en" });
    show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(EN.h1);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(3);
    for (const a of links) expect(a.getAttribute("href")).toBe("/login");
  });

  it("is right-to-left in Arabic", () => {
    setUi({ lang: "ar" });
    const { container } = show();
    expect(container.firstElementChild?.getAttribute("dir")).toBe("rtl");
    expect(within(container).getByRole("heading", { level: 1 }).textContent).toBe(AR.h1);
  });

  it("has the same shape in both languages", () => {
    for (const k of Object.keys(EN) as (keyof typeof EN)[]) {
      const [a, b] = [EN[k], AR[k]];
      if (Array.isArray(a)) expect((b as unknown[]).length, k).toBe(a.length);
    }
  });
});
