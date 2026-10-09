import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A screen that asks for a string key that does not exist shows the raw key to the person using it (it happened with
 * "waitReview"), so every literal key used in the code must exist in the string tables.
 */
const SRC = join(__dirname, "..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

describe("string keys", () => {
  it("every literal i.S(...) key exists in the string tables", () => {
    const files = walk(SRC).map((x) => x.split(String.fromCharCode(92)).join("/"));
    const keys = new Set<string>();
    for (const f of files.filter((x) => /i18n\/strings[^/]*\.ts$/.test(x))) {
      for (const m of readFileSync(f, "utf8").matchAll(/^\s*"?([A-Za-z0-9_]+)"?\s*:\s*[[(]/gm))
        keys.add(m[1]!);
    }
    const missing: string[] = [];
    for (const f of files.filter((x) => !/i18n\//.test(x) && !/\.test\.tsx?$/.test(x))) {
      for (const m of readFileSync(f, "utf8").matchAll(/\b(?:i\.S|S)\(\s*"([A-Za-z0-9_]+)"/g)) {
        if (!keys.has(m[1]!)) missing.push(`${m[1]} (${f.slice(SRC.length)})`);
      }
    }
    expect(missing).toEqual([]);
  });
});
