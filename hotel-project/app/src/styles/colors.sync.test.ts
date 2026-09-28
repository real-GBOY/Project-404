import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { colors } from "./colors";

/**
 * tokens.css keeps its own literal copy of every `colors.ts` value (Tailwind v4's CSS-first
 * `@theme` can't import a `.ts` module). This parses its `--color-*` declarations and asserts
 * they match `colors.ts` exactly, in both directions — same guard as atlas/web.
 */
describe("colors.ts / tokens.css stay in sync", () => {
  const css = readFileSync(path.join(__dirname, "tokens.css"), "utf-8");

  const cssColors = new Map<string, string>();
  for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)) {
    const [, kebabName, value] = match;
    const camelName = kebabName!.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    cssColors.set(camelName, value!.trim());
  }

  it("found color declarations to compare", () => {
    expect(cssColors.size).toBeGreaterThan(20);
  });

  it("every colors.ts token exists in tokens.css with the same value", () => {
    for (const [name, value] of Object.entries(colors)) {
      expect(cssColors.get(name), `--color-${name} missing from tokens.css`).toBe(value);
    }
  });

  it("every tokens.css color exists in colors.ts with the same value", () => {
    const known: Record<string, string> = colors;
    for (const [name, value] of cssColors) {
      expect(known[name], `"${name}" (--color-${name}) missing from colors.ts`).toBe(value);
    }
  });
});
