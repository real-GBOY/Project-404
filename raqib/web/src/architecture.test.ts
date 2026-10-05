import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The shape of the web app, enforced. Code is layered; a layer may only depend on the ones listed for it, so the low layers
 * (api, services, config, styles) stay free of React screens, and screens never reach around the layers beneath them.
 *
 *   config, styles        constants (endpoints, env, colors, type); depend on nothing
 *   services              transport, storage, the offline queue; framework-free
 *   api                   one typed function per backend route; over services
 *   i18n, state           strings and UI state
 *   presenters            view-model builders and the Actions/Ctx contracts the screens are rendered from
 *   hooks                 React hooks: server data, commands, effects
 *   components            shared hand-written UI
 *   ui                    the design's screens (generated) and their view-model type
 *   features              self-contained product areas (auth, account, onboarding, demo)
 *   app                   the shell that composes everything
 */
const ALLOWED: Record<string, string[]> = {
  config: [],
  styles: [],
  services: ["config"],
  api: ["config", "services"],
  i18n: ["api"],
  state: ["api", "i18n"],
  presenters: ["api", "config", "i18n", "services", "state", "styles", "ui"],
  hooks: ["api", "config", "i18n", "presenters", "services", "state", "styles"],
  components: ["api", "config", "hooks", "i18n", "services", "state", "styles", "ui"],
  ui: ["components", "styles"],
  features: [
    "api",
    "components",
    "config",
    "hooks",
    "i18n",
    "presenters",
    "services",
    "state",
    "styles",
    "ui",
  ],
  app: [
    "api",
    "components",
    "config",
    "features",
    "hooks",
    "i18n",
    "presenters",
    "services",
    "state",
    "styles",
    "ui",
  ],
};

const SRC = __dirname;

function sources(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "test" ? [] : sources(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

const rel = (p: string) => relative(SRC, p).replace(/\\/g, "/");
const layerOf = (path: string) => path.split("/")[0]!;

describe("architecture", () => {
  it("only depends downwards: each layer imports from the layers allowed for it", () => {
    const violations: string[] = [];
    for (const file of sources()) {
      const from = layerOf(rel(file));
      const allowed = ALLOWED[from];
      if (!allowed) continue; // main.tsx and files at the root
      for (const m of readFileSync(file, "utf8").matchAll(/from "@\/([^"]+)"/g)) {
        if (m[1]!.startsWith("api/types")) continue; // the domain types are the shared vocabulary every layer may name
        const to = layerOf(m[1]!);
        if (to !== from && ALLOWED[to] && !allowed.includes(to))
          violations.push(`${rel(file)} (${from}) imports @/${m[1]} (${to})`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("reaches the network only through api/ and services/ (no fetch in screens, hooks or features)", () => {
    const offenders = sources()
      .filter((f) => !/^(api|services)\//.test(rel(f)))
      .filter((f) => /\bfetch\(/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders, `Use an api/ function instead of fetch: ${offenders.join(", ")}`).toEqual([]);
  });

  it("names a font stack in exactly one place (styles/typography.ts)", () => {
    const offenders = sources()
      .filter((f) => rel(f) !== "styles/typography.ts")
      .filter((f) => /IBM Plex/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders, `Use FONT from @/styles/typography: ${offenders.join(", ")}`).toEqual([]);
  });

  it("keeps one file per concern: no source file grows past 450 lines outside the generated screens and string tables", () => {
    const big = sources()
      .filter((f) => !/^(ui\/generated|i18n)\//.test(rel(f)))
      .map((f) => [rel(f), readFileSync(f, "utf8").split("\n").length] as const)
      .filter(([, n]) => n > 450)
      .map(([f, n]) => `${f}: ${n} lines`);
    expect(big, `Split these: ${big.join(", ")}`).toEqual([]);
  });
});
