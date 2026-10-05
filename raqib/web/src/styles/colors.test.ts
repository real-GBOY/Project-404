import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { C, COLORS, flattenColors } from "./colors";

const SRC = join(__dirname, "..");
const read = (p: string) => readFileSync(p, "utf8");

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p, ext) : ext.test(name) ? [p] : [];
  });
}

describe("colors", () => {
  it("has no two tokens with the same value, so each color has exactly one name", () => {
    const seen = new Map<string, string>();
    for (const [name, value] of flattenColors()) {
      const key = value.replace(/\s/g, "").toUpperCase();
      expect(seen.get(key), `${name} duplicates ${seen.get(key)}`).toBeUndefined();
      seen.set(key, name);
    }
  });

  it("exposes C as the short name of COLORS", () => {
    expect(C).toBe(COLORS);
  });

  it("keeps tokens.css in step with colors.ts (run `npm run colors:sync` after editing colors.ts)", () => {
    const css = read(join(SRC, "styles/tokens.css"));
    const declared = new Map(
      [...css.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
    );
    const expected = flattenColors();
    expect(declared.size).toBe(expected.length);
    for (const [name, value] of expected)
      expect(declared.get(name)?.toLowerCase(), `--color-${name}`).toBe(value.toLowerCase());
  });

  it("appears nowhere else: no hex or rgba literal in any other source file, and no hex in a stylesheet", () => {
    const literal = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b|rgba?\(/;
    const offenders: string[] = [];
    for (const f of files(SRC, /\.(ts|tsx)$/)) {
      const rel = relative(SRC, f).replace(/\\/g, "/");
      if (rel === "styles/colors.ts" || /\.test\.tsx?$/.test(rel)) continue;
      read(f)
        .split("\n")
        .forEach((line, i) => {
          if (literal.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`);
        });
    }
    for (const f of files(SRC, /\.css$/)) {
      const rel = relative(SRC, f).replace(/\\/g, "/");
      if (rel === "styles/tokens.css") continue;
      read(f)
        .split("\n")
        .forEach((line, i) => {
          if (literal.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(
      offenders,
      `Color literals belong in src/styles/colors.ts:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
