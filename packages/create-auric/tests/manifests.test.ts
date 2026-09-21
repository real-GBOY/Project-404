import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadManifests, type Manifest } from "../src/manifest.js";
import { isProductRegion, regionNames } from "../src/regions.js";
import { indexUniverse } from "../src/schema.js";

/**
 * The manifests are the source of truth for scaffolding, so they must agree with
 * the code they describe. These tests are the drift guard: change a module's
 * tables, dependencies, wiring or SQL without updating its manifest and one of
 * them fails.
 */
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const coreDir = join(repoRoot, "core");
const prismaDir = join(repoRoot, "prisma", "schema");
const rootPkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const manifests = loadManifests(coreDir);
const byName = new Map(manifests.map((m) => [m.name, m]));
const read = (rel: string) => readFileSync(join(coreDir, rel), "utf8");

/** Every module `name` needs, directly or transitively (including itself). */
function closure(name: string): Set<string> {
  const seen = new Set<string>([name]);
  const queue = [name];
  while (queue.length > 0) {
    for (const dep of Object.keys(byName.get(queue.shift()!)!.dependsOn)) {
      if (!seen.has(dep)) {
        seen.add(dep);
        queue.push(dep);
      }
    }
  }
  return seen;
}

describe("module manifests", () => {
  it("declares exactly one required base module", () => {
    expect(manifests.filter((m) => m.required).map((m) => m.name)).toEqual(["base"]);
  });

  it("only depends on modules that exist", () => {
    for (const m of manifests) {
      for (const dep of Object.keys(m.dependsOn)) {
        expect(byName.has(dep), `${m.name} -> ${dep}`).toBe(true);
        expect(dep).not.toBe(m.name);
      }
    }
  });

  it("owns every top-level Core directory exactly once", () => {
    const owners = new Map<string, string[]>();
    for (const m of manifests) {
      for (const p of m.paths) owners.set(p, [...(owners.get(p) ?? []), m.name]);
    }
    const dirs = readdirSync(coreDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      // `tests` is owned file-by-file through each module's `tests` list.
      .filter((d) => d !== "tests");
    for (const d of dirs) expect(owners.get(d), `core/${d}`).toHaveLength(1);
    for (const [p] of owners) expect(existsSync(join(coreDir, p)), `core/${p}`).toBe(true);
  });

  it("assigns every core/tests file to exactly one module", () => {
    const listed = manifests.flatMap((m) => m.tests.filter((t) => t.startsWith("tests/")));
    const onDisk = readdirSync(join(coreDir, "tests")).map((f) => `tests/${f}`);
    expect([...listed].sort()).toEqual([...onDisk].sort());
  });

  it("lists module test paths that exist", () => {
    for (const m of manifests) for (const t of m.tests) expect(existsSync(join(coreDir, t)), t).toBe(true);
  });

  it("lists loose files that exist", () => {
    for (const m of manifests) for (const f of m.files) expect(existsSync(join(coreDir, f)), f).toBe(true);
  });

  describe("prisma", () => {
    const universe = indexUniverse(prismaDir, manifests);

    it("each module's tables match its Prisma @@map tables", () => {
      for (const m of manifests) {
        const actual = [...universe.values()].filter((i) => i.module === m.name).map((i) => i.table).sort();
        expect(actual, m.name).toEqual([...m.tables].sort());
      }
    });

    it("covers every non-product Prisma file", () => {
      const claimed = new Set(manifests.flatMap((m) => m.prisma));
      const unclaimed = readdirSync(prismaDir)
        .filter((f) => f.endsWith(".prisma") && f !== "datasource.prisma" && !f.startsWith("lawfirm-"))
        .filter((f) => !claimed.has(f));
      expect(unclaimed).toEqual([]);
    });

    it("never claims a product (lawfirm-*) schema", () => {
      for (const m of manifests) for (const f of m.prisma) expect(f.startsWith("lawfirm-"), f).toBe(false);
    });

    it("dependsOn covers every cross-module model reference (transitively closed)", () => {
      for (const info of universe.values()) {
        for (const ref of info.references) {
          const target = universe.get(ref)!;
          expect(closure(info.module).has(target.module), `${info.model} (${info.module}) -> ${ref} (${target.module})`).toBe(true);
        }
      }
    });
  });

  describe("sql fragments", () => {
    it("every referenced fragment exists", () => {
      for (const m of manifests) {
        for (const list of Object.values(m.sql)) for (const f of list) expect(existsSync(join(coreDir, f)), `${m.name}: ${f}`).toBe(true);
      }
    });

    it("every RLS-enabled table is FORCEd, and every module's RLS only names its own tables", () => {
      for (const m of manifests) {
        const sql = m.sql.rls.map(read).join("\n");
        const enabled = [...sql.matchAll(/ALTER TABLE "?(\w+)"?\s+ENABLE ROW LEVEL SECURITY/g)].map((x) => x[1]);
        const forced = [...sql.matchAll(/ALTER TABLE "?(\w+)"?\s+FORCE\s+ROW LEVEL SECURITY/g)].map((x) => x[1]);
        expect(forced.sort(), m.name).toEqual(enabled.sort());
        // DO-block style (messaging/assistant) lists tables in an ARRAY[...] instead.
        const arrayTables = [...sql.matchAll(/ARRAY\[([^\]]+)\]/g)].flatMap((x) => [...x[1]!.matchAll(/'(\w+)'/g)].map((y) => y[1]!));
        for (const t of [...enabled, ...arrayTables]) expect(m.tables, `${m.name} RLS on ${t}`).toContain(t);
      }
    });
  });

  describe("npm", () => {
    it("every external package a module imports is declared by it or by something it depends on", () => {
      // Source and tests alike: a project generated from these modules must be able to import them all.
      const sources = (m: Manifest): string[] => {
        const walk = (rel: string): string[] => {
          const full = join(coreDir, rel);
          if (!existsSync(full)) return [];
          return statSync(full).isDirectory()
            ? readdirSync(full).flatMap((e) => (e === "node_modules" ? [] : walk(`${rel}/${e}`)))
            : rel.endsWith(".ts")
              ? [rel]
              : [];
        };
        return [...m.paths, ...m.files, ...m.tests].flatMap(walk).filter((f) => f !== "kernel/db/schema.ts");
      };
      const declared = (name: string) =>
        new Set([...closure(name)].flatMap((n) => [...byName.get(n)!.npm.dependencies, ...byName.get(n)!.npm.devDependencies]));

      const missing: string[] = [];
      for (const m of manifests) {
        const ok = declared(m.name);
        for (const file of sources(m)) {
          for (const match of read(file).matchAll(/(?:from|import)\s+"([^"./][^"]*)"/g)) {
            const spec = match[1]!;
            if (spec.startsWith("node:") || spec.startsWith("@core/")) continue;
            const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!;
            if (!ok.has(pkg)) missing.push(`${m.name}: core/${file} imports "${pkg}"`);
          }
        }
      }
      expect([...new Set(missing)]).toEqual([]);
    });

    it("declares the packages that are loaded implicitly by a dependency, not imported", () => {
      // @nestjs/swagger serves the API docs UI through @fastify/static on a Fastify app; nothing imports it.
      // Missing it crashes boot in a fresh install ("The @fastify/static package is missing").
      expect(byName.get("base")!.npm.dependencies).toContain("@fastify/static");
    });

    it("every listed package has a version in the monorepo package.json", () => {
      const known = { ...rootPkg.dependencies, ...rootPkg.devDependencies };
      for (const m of manifests) {
        for (const dep of [...m.npm.dependencies, ...m.npm.devDependencies]) expect(known[dep], `${m.name}: ${dep}`).toBeDefined();
      }
    });
  });

  describe("wiring regions", () => {
    const optional = manifests.filter((m) => !m.required && m.name !== "identity" && m.name !== "organizations" && m.name !== "rbac");

    it("every region name in the wiring files is a real module", () => {
      for (const file of ["app.module.ts", "index.ts", "bootstrap/seed.service.ts", "contracts/index.ts", "tests/helpers.ts", "identity/identity.module.ts", "http/openapi.ts"]) {
        // `product-*` regions hold product-only code; every scaffold (and the package snapshot) strips them.
        for (const name of regionNames(read(file))) expect(byName.has(name) || isProductRegion(name), `${file}: ${name}`).toBe(true);
      }
    });

    it("each optional module's Nest modules appear only inside its own region in app.module.ts", () => {
      const app = read("app.module.ts");
      for (const m of optional) {
        for (const cls of m.wiring.nestModules) {
          const region = new RegExp(`// @auric-begin ${m.name}\\n[^]*?// @auric-end ${m.name}`, "g");
          const inRegions = (app.match(region) ?? []).join("\n");
          const total = app.match(new RegExp(`\\b${cls}\\b`, "g"))?.length ?? 0;
          const inside = inRegions.match(new RegExp(`\\b${cls}\\b`, "g"))?.length ?? 0;
          expect(total, `${cls} is wired`).toBeGreaterThan(0);
          expect(inside, `${cls} is wired ONLY inside @auric-begin ${m.name}`).toBe(total);
        }
      }
    });

    it("each optional module's permissions and seeders appear only inside its own region in seed.service.ts", () => {
      const seed = read("bootstrap/seed.service.ts");
      for (const m of manifests.filter((x) => !x.required)) {
        for (const ref of [...m.permissions, ...m.seed]) {
          const total = seed.match(new RegExp(`\\b${ref.symbol}\\b`, "g"))?.length ?? 0;
          expect(total, `${m.name}: ${ref.symbol} used by the seeder`).toBeGreaterThan(0);
          if (!optional.includes(m)) continue; // the identity/orgs/rbac trio is always present
          const region = new RegExp(`// @auric-begin ${m.name}\\n[^]*?// @auric-end ${m.name}`, "g");
          const inside = (seed.match(region) ?? []).join("\n").match(new RegExp(`\\b${ref.symbol}\\b`, "g"))?.length ?? 0;
          expect(inside, `${ref.symbol} only inside @auric-begin ${m.name}`).toBe(total);
        }
      }
    });

    it("core/index.ts keeps optional module exports inside their regions", () => {
      const index = read("index.ts");
      for (const m of optional) {
        for (const cls of m.wiring.nestModules) {
          const region = new RegExp(`// @auric-begin ${m.name}\\n[^]*?// @auric-end ${m.name}`, "g");
          const inside = (index.match(region) ?? []).join("\n").match(new RegExp(`\\b${cls}\\b`, "g"))?.length ?? 0;
          expect(inside, `${cls} exported only inside @auric-begin ${m.name}`).toBe(index.match(new RegExp(`\\b${cls}\\b`, "g"))?.length ?? 0);
        }
      }
    });
  });

  describe("import boundaries", () => {
    /** Non-test source files of a module's directories. */
    const sourceFiles = (m: Manifest): string[] =>
      m.paths.flatMap((p) => {
        const walk = (dir: string): string[] =>
          readdirSync(join(coreDir, dir), { withFileTypes: true }).flatMap((e) => {
            const rel = `${dir}/${e.name}`;
            if (e.isDirectory()) return e.name === "tests" || e.name === "scaffold" ? [] : walk(rel);
            return e.name.endsWith(".ts") ? [rel] : [];
          });
        return walk(p);
      });

    it("no module imports another module it does not (transitively) depend on — outside regions", () => {
      const dirOwner = new Map<string, string>();
      for (const m of manifests) for (const p of m.paths) dirOwner.set(p, m.name);


      const violations: string[] = [];
      for (const m of manifests) {
        const allowed = closure(m.name);
        for (const file of sourceFiles(m)) {
          // Strip regions of every module this module does NOT depend on: those lines
          // never reach a scaffold that lacks that module.
          const text = read(file)
            .split(/\r?\n/)
            .reduce<{ keep: string[]; skipping: string | undefined }>(
              (acc, line) => {
                const begin = /^\s*\/\/ @auric-begin (\S+)/.exec(line);
                const end = /^\s*\/\/ @auric-end (\S+)/.exec(line);
                if (begin) acc.skipping = allowed.has(begin[1]!) ? undefined : begin[1];
                else if (end) acc.skipping = undefined;
                else if (!acc.skipping) acc.keep.push(line);
                return acc;
              },
              { keep: [], skipping: undefined },
            ).keep.join("\n");
          for (const match of text.matchAll(/from "@core\/([a-z]+)\//g)) {
            const owner = dirOwner.get(match[1]!);
            if (owner && !allowed.has(owner)) violations.push(`${file} imports @core/${match[1]} (module "${owner}")`);
          }
        }
      }
      expect(violations).toEqual([]);
    });
  });
});
