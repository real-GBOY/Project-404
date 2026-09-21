import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanForForbidden } from "../src/audit.js";
import { toAuricError } from "../src/errors.js";
import { loadManifests, type Manifest } from "../src/manifest.js";
import { isProductRegion, removeRegions } from "../src/regions.js";
import { resolveSelection } from "../src/resolve.js";
import { assembleSchema, indexUniverse, SchemaClosureError } from "../src/schema.js";
import { repoRoot } from "./support.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "auric-safety-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const put = (rel: string, content = "x") => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), content);
};

describe("the public-package audit (it must be able to fail)", () => {
  it("passes ordinary, reusable code", () => {
    put("core/kernel/config.ts", 'export const port = 3000; // see https://example.com/docs\nconst ip = "127.0.0.1";');
    put("core/identity/README.md", "Users sign in with an email and password. Demonstration only: a demonstrator.");
    put("prisma/schema/rbac.prisma", "model roles { id String @id }");
    expect(scanForForbidden(dir)).toEqual([]);
  });

  it.each([
    ["product code in a path", "core/mizan/thing.ts", "export {}", /product\/demo name in a file path/],
    ["product vocabulary in content", "core/x.ts", "// used by the Mizan law-firm app", /product\/demo name/],
    ["another product", "core/x.ts", "const atlas = 1; // Atlas dashboard", /product\/demo name/],
    ["real estate", "core/x.ts", "// real-estate leads", /product\/demo name/],
    ["demo data", "core/seed.ts", "const demo = true;", /product\/demo name/],
    ["demo file name", "core/demo-data.ts", "export {}", /product\/demo name in a file path/],
    ["an env file", ".env", "AURIC_JWT_SECRET=x", /environment file/],
    ["an env file variant", "config/.env.production", "X=1", /environment file/],
    ["a Groq key", "core/x.ts", 'const k = "gsk_abcdefghijklmnopqrstuvwxyz0123";', /Groq API key/],
    ["an API key", "core/x.ts", 'const k = "sk-abcdefghijklmnopqrstuvwxyz0123456";', /API key/],
    ["an AWS key", "core/x.ts", "const k = 'AKIAABCDEFGHIJKLMNOP';", /AWS access key/],
    ["a private key", "core/key.txt", "-----BEGIN RSA PRIVATE KEY-----\nabc", /private key/],
    ["a JWT", "core/x.ts", 'const t = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk";', /JWT/],
    ["a Windows machine path", "core/x.ts", 'const p = "C:\\\\Users\\\\bob\\\\code";', /absolute Windows path/],
    ["a Unix home path", "core/x.ts", 'const p = "/home/deploy/app/x";', /absolute home path/],
    ["a deployment host", "core/x.ts", 'const u = "https://100-26-109-162.sslip.io";', /deployment hostname/],
    ["a machine username", "core/x.ts", "// author: mahmm", /machine username/],
    ["a database file", "storage/local.sqlite", "x", /secret, database or temp file/],
    ["a log", "run.log", "x", /secret, database or temp file/],
    ["node_modules", "node_modules/x/index.js", "x", /must not be published/],
  ])("catches %s", (_label, file, content, rule) => {
    put(file, content);
    const findings = scanForForbidden(dir);
    expect(findings.length, JSON.stringify(findings)).toBeGreaterThan(0);
    expect(findings.map((f) => f.rule).join("|")).toMatch(rule);
  });

  it("allows documented placeholder credentials", () => {
    put("core/files/tests/x.test.ts", 'const id = "AKIAIOSFODNN7EXAMPLE";');
    expect(scanForForbidden(dir)).toEqual([]);
  });

  it("lets documentation use a generic domain example, but still not a product or a secret", () => {
    put("docs/guide.md", "Example: a real-estate SaaS with Property and Lead.");
    expect(scanForForbidden(dir, { docs: /^docs\// })).toEqual([]);
    expect(scanForForbidden(dir).length).toBeGreaterThan(0); // outside docs it is still forbidden
    put("docs/bad.md", "Built for the Mizan firm; key gsk_abcdefghijklmnopqrstuvwxyz0123");
    const rules = scanForForbidden(dir, { docs: /^docs\// }).map((f) => f.rule);
    expect(rules).toEqual(expect.arrayContaining(["product/demo name", "Groq API key"]));
  });

  it("treats the developer's own project name as theirs — but only that exact string", () => {
    put("package.json", '{ "name": "demo-app" }');
    put("README.md", "# demo-app\n");
    expect(scanForForbidden(dir).length).toBeGreaterThan(0); // without the allowance the name looks like a leak
    expect(scanForForbidden(dir, { allow: ["demo-app"] })).toEqual([]);
    // A real leak next to it is still caught, on the right line.
    put("src/x.ts", "// demo-app is fine\n// but Mizan is not\n");
    const found = scanForForbidden(dir, { allow: ["demo-app"] });
    expect(found.map((f) => f.file)).toEqual(["src/x.ts:2"]);
  });

  it("names the file and line", () => {
    put("core/x.ts", "ok\nok\n// Mizan\n");
    expect(scanForForbidden(dir)[0]).toMatchObject({ file: "core/x.ts:3" });
  });
});

describe("product-only regions", () => {
  it("removes only product regions, keeping module regions and their markers", () => {
    const src = [
      "a",
      "// @auric-begin files",
      "b",
      "// @auric-end files",
      "// @auric-begin product-lawfirm",
      "SECRET PRODUCT LINE",
      "// @auric-end product-lawfirm",
      "c",
    ].join("\n");
    const out = removeRegions(src, isProductRegion);
    expect(out).toBe(["a", "// @auric-begin files", "b", "// @auric-end files", "c"].join("\n"));
    expect(out).not.toContain("SECRET");
  });

  it("rejects malformed product regions", () => {
    expect(() => removeRegions("// @auric-begin product-x\nx", isProductRegion)).toThrow(/never closed/);
    expect(() => removeRegions("// @auric-end product-x", isProductRegion)).toThrow(/does not match/);
  });
});

describe("invalid module relationships fail clearly", () => {
  const manifests = loadManifests(join(repoRoot, "core"));
  const withDependsOn = (name: string, dependsOn: Record<string, string>): Manifest[] =>
    manifests.map((m) => (m.name === name ? { ...m, dependsOn } : m));

  it("an unresolved dependency names the module that is missing", () => {
    const broken = withDependsOn("files", { base: "kernel", ghost: "does not exist" });
    expect(() => resolveSelection(broken, ["files"])).toThrow(/Unknown module "ghost" \(required by files\)/);
    const err = toAuricError(new Error('Unknown module "ghost" (required by files). Known: a, b'));
    expect(err.code).toBe("UNKNOWN_MODULE");
    expect(err.what).toBe('Unknown module "ghost"');
  });

  it("a missing required relation is a schema-closure error naming both modules", () => {
    // notifications holds foreign keys to identity and organizations; leave them out.
    try {
      assembleSchema(join(repoRoot, "prisma", "schema"), manifests, ["base", "notifications"]);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaClosureError);
      const e = toAuricError(err);
      expect(e.code).toBe("SCHEMA_CLOSURE");
      expect(e.why).toMatch(/"notifications" \(notifications\) has a foreign key to "users" from module "identity"/);
      expect(e.why).toMatch(/add "identity" to notifications's dependsOn/);
    }
  });

  it("two modules defining the same model is a schema conflict", () => {
    const clash = manifests.map((m) => (m.name === "assistant" ? { ...m, prisma: [...m.prisma, "files.prisma"] } : m));
    expect(() => indexUniverse(join(repoRoot, "prisma", "schema"), clash)).toThrow(/Model "files" is defined by more than one module/);
  });

  it("an invalid manifest is reported with its file and every problem", () => {
    put("core/broken/auric.module.json", JSON.stringify({ manifestVersion: 2, name: "Bad Name", nope: true }));
    try {
      loadManifests(join(dir, "core"));
      expect.unreachable();
    } catch (err) {
      const e = toAuricError(err);
      expect(e.code).toBe("MANIFEST_INVALID");
      expect(e.why).toMatch(/auric\.module\.json/);
      expect(e.why).toMatch(/manifestVersion/);
      expect(e.why).toMatch(/name/);
    }
  });

  it("two manifests with the same name are rejected", () => {
    const body = JSON.stringify({
      manifestVersion: 1,
      name: "dup",
      title: "Dup",
      description: "d",
      paths: ["a"],
      prisma: [],
      tables: [],
    });
    put("core/one/auric.module.json", body);
    put("core/two/auric.module.json", body);
    expect(() => loadManifests(join(dir, "core"))).toThrow(/Duplicate module name "dup"/);
  });

  it("maps filesystem and Prisma failures to actionable errors", () => {
    const fs = toAuricError(Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" }));
    expect(fs.code).toBe("FS_FAILED");
    expect(fs.hint).toMatch(/write permission/);
    const disk = toAuricError(Object.assign(new Error("no space"), { code: "ENOSPC" }));
    expect(disk.hint).toMatch(/disk space/);
    const prisma = toAuricError(new Error("prisma migrate diff failed:\nP1012 schema is invalid"));
    expect(prisma.code).toBe("PRISMA_FAILED");
    expect(prisma.why).toContain("P1012");
    expect(prisma.hint).toMatch(/--verbose/);
    const other = toAuricError("weird");
    expect(other.code).toBe("UNEXPECTED");
    expect(other.why).toBe("weird");
  });
});
