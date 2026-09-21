import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatFindings, scanForForbidden } from "../src/audit.js";
import { loadManifests } from "../src/manifest.js";
import { isProductRegion, removeRegions } from "../src/regions.js";
import { packArtifact, repoRoot, type PackedArtifact } from "./support.js";

/**
 * What would actually be published. The tarball is built with the real pipeline
 * (`build.mjs` → `npm pack`), extracted, and inspected — not the source tree.
 */
vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });

let art: PackedArtifact;
beforeAll(async () => {
  art = await packArtifact();
});
afterAll(async () => art?.cleanup());

const manifests = loadManifests(join(repoRoot, "core"));
const read = (rel: string) => readFileSync(join(art.extracted, rel), "utf8");
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const rel = (root: string, full: string) => full.slice(root.length + 1).split("\\").join("/");

describe("the published tarball", () => {
  it("ships the CLI, the engine, the Core snapshot and the templates", () => {
    for (const f of [
      "package.json",
      "README.md",
      "LICENSE",
      "bin/create-auric.js",
      "dist/cli/main.js",
      "dist/index.js",
      "assets/package.json",
      "assets/SNAPSHOT.json",
      "assets/scripts/migrate.ts",
      "assets/scripts/provision-db.ts",
      "assets/scripts/build.mjs",
      "templates/main.ts",
      "templates/tsconfig.json",
      "templates/datasource.prisma",
      "templates/gitignore",
      "templates/swcrc",
      "docs/create-auric.md",
    ]) {
      expect(art.files, f).toContain(f);
    }
    for (const m of manifests) {
      const dir = m.name === "base" ? "kernel" : m.name;
      expect(art.files, `manifest of ${m.name}`).toContain(`assets/core/${dir}/auric.module.json`);
      for (const p of m.prisma) expect(art.files, p).toContain(`assets/prisma/schema/${p}`);
      for (const list of Object.values(m.sql)) for (const f of list) expect(art.files, f).toContain(`assets/core/${f}`);
    }
  });

  it("ships nothing else: no sources, tests, build scripts or configs", () => {
    const allowed = /^(bin|dist|assets|templates|docs)\/|^(package\.json|README\.md|LICENSE)$/;
    expect(art.files.filter((f) => !allowed.test(f))).toEqual([]);
    expect(art.files.filter((f) => /^(src|tests|scripts)\//.test(f))).toEqual([]);
    expect(art.files.filter((f) => /\.(test|spec)\.[jt]s$/.test(f) && !f.startsWith("assets/core/"))).toEqual([]);
    expect(art.files.filter((f) => f.endsWith(".tgz") || f.endsWith(".map"))).toEqual([]);
  });

  it("contains no forbidden file names (case-insensitive)", () => {
    const forbidden = art.files.filter((f) => /mizan|atlas|lawfirm|realestate|real-estate|demo|(^|\/)\.env/i.test(f));
    expect(forbidden).toEqual([]);
  });

  it("passes the content audit: no product code, demo data, secrets or machine paths", () => {
    // The audit's own compiled rules necessarily spell out the words it hunts for. Docs may use a
    // generic business domain (a real-estate SaaS) as their worked example — never a product name.
    const findings = scanForForbidden(art.extracted, { skipContent: /(^|\/)dist\/audit\.js$/, docs: /^docs\// });
    expect(findings, formatFindings(findings)).toEqual([]);
  });

  it("keeps product-only regions and product schemas out of the snapshot", () => {
    for (const f of walk(join(art.extracted, "assets"))) {
      expect(readFileSync(f, "utf8"), rel(art.extracted, f)).not.toMatch(/@auric-(begin|else|end) product-|lawfirm|Mizan/i);
    }
    const schemas = readdirSync(join(art.extracted, "assets", "prisma", "schema"));
    expect(schemas.filter((f) => f.startsWith("lawfirm-") || f.includes("realestate"))).toEqual([]);
    expect(schemas.sort()).toEqual([...new Set(manifests.flatMap((m) => m.prisma))].sort());
  });

  it("does not ship monorepo documentation or generated types", () => {
    expect(art.files.filter((f) => f.endsWith("README.md") && f.startsWith("assets/"))).toEqual([]);
    expect(art.files).not.toContain("assets/core/kernel/db/schema.ts");
    expect(art.files).toContain("assets/core/kernel/db/json.ts");
  });

  it("has a snapshot that matches the source it came from", () => {
    const assets = join(art.extracted, "assets", "core");
    for (const f of walk(assets).filter((x) => x.endsWith(".ts"))) {
      const r = rel(assets, f);
      const expected = removeRegions(readFileSync(join(repoRoot, "core", r), "utf8"), isProductRegion, r);
      expect(readFileSync(f, "utf8"), r).toBe(expected);
    }
    // ...and is complete: every source file a module owns is present.
    for (const m of manifests) {
      for (const p of m.paths) {
        for (const f of walk(join(repoRoot, "core", p))) {
          const r = rel(join(repoRoot, "core"), f);
          if (r.endsWith("README.md") || r === "kernel/db/schema.ts") continue;
          expect(existsSync(join(assets, r)), `missing from snapshot: core/${r}`).toBe(true);
        }
      }
    }
  });

  it("carries a content manifest whose hashes are true", () => {
    const snap = JSON.parse(read("assets/SNAPSHOT.json")) as { version: string; files: Record<string, string> };
    const pkg = JSON.parse(read("package.json")) as { version: string };
    expect(snap.version).toBe(pkg.version);
    const assets = join(art.extracted, "assets");
    const onDisk = walk(assets).map((f) => rel(assets, f)).filter((f) => f !== "SNAPSHOT.json").sort();
    expect(Object.keys(snap.files).sort()).toEqual(onDisk);
    for (const [file, hash] of Object.entries(snap.files)) {
      const text = readFileSync(join(assets, file), "utf8").replace(/\r\n/g, "\n");
      expect(createHash("sha256").update(text).digest("hex"), file).toBe(hash);
    }
  });

  it("declares a sane, self-contained package.json", () => {
    const pkg = JSON.parse(read("package.json")) as Record<string, unknown> & {
      bin: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.name).toBe("create-auric");
    expect(pkg.private).toBeUndefined();
    expect(pkg.license).toBe("MIT");
    // Metadata comes from what really exists (the monorepo's git remote + LICENSE), never invented.
    expect(pkg.author).toBe("Mahmoud Nayel");
    expect(pkg.repository).toMatchObject({ type: "git", directory: "packages/create-auric" });
    expect((pkg.repository as { url: string }).url).toMatch(/^git\+https:\/\/github\.com\/[\w-]+\/[\w.-]+\.git$/);
    expect(pkg.description as string).toMatch(/developer-owned/i);
    expect(pkg.keywords).toEqual(expect.arrayContaining(["scaffold", "multi-tenant"]));
    expect(pkg.engines).toEqual({ node: "^22.12.0 || >=24.0.0" });
    expect(read("LICENSE")).toContain("MIT License");
    expect(pkg.bin).toEqual({ "create-auric": "bin/create-auric.js" });
    expect(existsSync(join(art.extracted, pkg.bin["create-auric"]!))).toBe(true);
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["@clack/prompts", "picocolors", "prisma", "prisma-kysely", "zod"]);
    // Exact versions: the CLI's own output (Prisma's generated SQL) must not drift with a newer transitive release.
    for (const spec of Object.values(pkg.dependencies)) expect(spec).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies).toBeUndefined();
    expect(pkg.scripts).toBeDefined(); // build/prepack are harmless for consumers; they never run on install
    expect(read("bin/create-auric.js")).toMatch(/^#!\/usr\/bin\/env node/);
  });

  it("gives generated projects the exact tested dependency versions, not floating ranges", () => {
    const table = JSON.parse(read("assets/package.json")) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const all = { ...table.dependencies, ...table.devDependencies };
    const wanted = new Set(manifests.flatMap((m) => [...m.npm.dependencies, ...m.npm.devDependencies]));
    expect(Object.keys(all).sort()).toEqual([...wanted].sort());
    for (const [name, version] of Object.entries(all)) {
      expect(version, name).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
      // ...and they are what the monorepo actually has installed.
      const installed = (JSON.parse(readFileSync(join(repoRoot, "node_modules", name, "package.json"), "utf8")) as { version: string }).version;
      expect(version, name).toBe(installed);
    }
    // Packages Nest pins exactly must agree, or a fresh install gets two copies.
    expect(all.fastify).toBe((JSON.parse(readFileSync(join(repoRoot, "node_modules/@nestjs/platform-fastify/package.json"), "utf8")) as { dependencies: Record<string, string> }).dependencies.fastify);
  });

  it("never reaches back into the monorepo at runtime", () => {
    for (const f of walk(join(art.extracted, "dist")).filter((x) => x.endsWith(".js"))) {
      const text = readFileSync(f, "utf8");
      expect(text, rel(art.extracted, f)).not.toMatch(/packages[\\/]create-auric|["']\.\.["'],\s*["']\.\.["'],\s*["']core["']|monorepo/);
    }
    // The only sources of Core are the bundled assets (plus an explicit override seam).
    const main = read("dist/cli/main.js");
    expect(main).toContain('"assets"');
  });

  it("positions AURIC as a developer-owned foundation, not a platform or a dependency", () => {
    const readme = read("README.md");
    expect(readme).toContain("Build your foundation. Own your code.");
    expect(readme).toMatch(/scaffold directly into your own project/);
    expect(readme).toMatch(/no `@auric\/core` runtime dependency/);
    expect(readme).toMatch(/not a hosted service/i);
    expect(readme).not.toMatch(/\b(ERP|SaaS platform)\b/);
  });

  it("ships a developer guide that stands on its own", () => {
    const guide = read("docs/create-auric.md");
    expect(guide).toContain("Generate the foundation. Own the source. Build your product.");
    for (const topic of [
      "Choosing modules",
      "The database, and who owns it",
      "Tenancy and row-level security",
      "RBAC",
      "Adding your business domain",
      "Troubleshooting",
      "real-estate SaaS",
    ]) {
      expect(guide, topic).toContain(topic);
    }
    expect(guide).not.toMatch(/mizan|atlas|lawfirm/i);
  });

  it("stays a reasonable size", () => {
    expect(statSync(art.tarball).size).toBeLessThan(2 * 1024 * 1024);
  });
});
