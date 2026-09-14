import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { colors } from "./colors";

/**
 * Guards the one place `colors.ts`'s "single source of truth" claim could silently
 * break: tokens.css keeps its own literal copy of every `TOKEN_COLORS` value (Tailwind
 * v4's CSS-first `@theme` can't import a `.ts` module), so nothing stops someone
 * editing one file and not the other. This parses tokens.css's `@theme` block and
 * asserts every `--color-*` declaration matches `colors.ts` exactly, in both directions.
 */
describe("colors.ts / tokens.css stay in sync", () => {
  const cssPath = path.join(__dirname, "tokens.css");
  const css = readFileSync(cssPath, "utf-8");

  const cssColors = new Map<string, string>();
  for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)) {
    const [, kebabName, hex] = match;
    const camelName = kebabName.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    cssColors.set(camelName, hex.toLowerCase());
  }

  it("found color declarations to compare", () => {
    expect(cssColors.size).toBeGreaterThan(20);
  });

  it("every colors.ts token exists in tokens.css with the same value", () => {
    for (const [name, hex] of Object.entries(colors)) {
      expect(cssColors.get(name), `--color-${name} missing from tokens.css`).toBe(hex);
    }
  });

  it("every tokens.css color exists in colors.ts with the same value", () => {
    for (const [name, hex] of cssColors) {
      expect(colors[name], `"${name}" (--color-${name}: ${hex}) missing from colors.ts`).toBe(hex);
    }
  });
});
