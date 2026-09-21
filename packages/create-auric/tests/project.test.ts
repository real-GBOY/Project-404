import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scaffold, type ScaffoldedProject } from "./support.js";

/**
 * What lands on disk. No database needed — `generateProject` is pure file
 * generation (the Prisma diff it shells out to is offline).
 */
const read = (p: ScaffoldedProject, rel: string) => readFileSync(join(p.outDir, rel), "utf8");
const has = (p: ScaffoldedProject, rel: string) => p.files.includes(rel);
const under = (p: ScaffoldedProject, prefix: string) => p.files.filter((f) => f.startsWith(prefix));

describe("generated project — base only", () => {
  let p: ScaffoldedProject;
  beforeAll(async () => {
    p = await scaffold("basic", []);
  }, 120_000);
  afterAll(async () => p?.cleanup());

  it("contains no code, schema or tests of modules that were not selected", () => {
    for (const dir of ["files", "notifications", "messaging", "assistant"]) {
      expect(under(p, `src/core/${dir}/`), `src/core/${dir}`).toEqual([]);
    }
    for (const f of ["files", "notifications", "messaging", "assistant"]) {
      expect(has(p, `prisma/schema/${f}.prisma`), `${f}.prisma`).toBe(false);
    }
    expect(has(p, "src/core/tests/core.integration.test.ts")).toBe(false); // notification-dependent
  });

  it("never copies scaffolding metadata or the monorepo's generated Kysely types", () => {
    expect(p.files.filter((f) => f.endsWith("auric.module.json"))).toEqual([]);
    expect(p.files.filter((f) => f.includes("/scaffold/"))).toEqual([]);
    expect(has(p, "src/core/kernel/db/schema.ts")).toBe(false); // (this scaffold skips types; see the typed one below)
    expect(has(p, "src/core/kernel/db/json.ts")).toBe(true);
  });

  it("strips every @auric region marker from every generated source file", () => {
    for (const f of p.files.filter((x) => x.endsWith(".ts"))) expect(read(p, f), f).not.toMatch(/@auric-(begin|else|end)/);
  });

  it("wires only the modules that exist", () => {
    const app = read(p, "src/core/app.module.ts");
    for (const gone of ["FilesModule", "NotificationsModule", "MessagingModule"]) expect(app, gone).not.toContain(gone);
    for (const kept of ["KernelModule", "EventsModule", "AuditModule", "RbacModule", "IdentityModule", "OrganizationsModule", "SecurityModule"]) {
      expect(app, kept).toContain(kept);
    }
    const seed = read(p, "src/core/bootstrap/seed.service.ts");
    for (const gone of ["filePermissions", "notificationPermissions", "messagingPermissions", "seedTemplates", "TemplateRepository"]) {
      expect(seed, gone).not.toContain(gone);
    }
    expect(read(p, "src/core/index.ts")).not.toMatch(/messaging|Messaging|@core\/assistant|FilesModule|NotificationsModule/);
    expect(read(p, "src/core/contracts/index.ts")).not.toMatch(/IMessagingProvider|messaging-types/);
  });

  it("turns email verification OFF when nothing can send the email", () => {
    const identity = read(p, "src/core/identity/identity.module.ts");
    expect(identity).toContain("{ provide: REQUIRE_EMAIL_VERIFICATION, useValue: false },");
    expect(identity).not.toContain("useValue: true");
  });

  it("only depends on packages the installed modules use", () => {
    const pkg = JSON.parse(read(p, "package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(pkg.dependencies).toHaveProperty("@nestjs/core");
    expect(pkg.dependencies).toHaveProperty("argon2"); // identity
    for (const gone of ["socket.io", "nodemailer"]) expect(pkg.dependencies, gone).not.toHaveProperty(gone);
    for (const gone of ["socket.io-client", "@types/nodemailer"]) expect(pkg.devDependencies, gone).not.toHaveProperty(gone);
    expect(pkg.devDependencies).toHaveProperty("prisma-kysely");
  });

  it("documents only the env vars of installed modules", () => {
    const env = read(p, ".env.example");
    expect(env).toContain("AURIC_DATABASE_URL");
    expect(env).toContain("AURIC_JWT_SECRET");
    for (const gone of ["AURIC_R2_", "AURIC_FILE_", "AURIC_SMTP_URL", "AURIC_MAIL_FROM", "AI_API_KEY"]) expect(env, gone).not.toContain(gone);
  });

  it("gives the developer their own migration history, with no product in it", () => {
    expect(under(p, "prisma/migrations/").map((f) => f.replace(/\d{14}/, "<ts>"))).toEqual([
      "prisma/migrations/<ts>_auric_baseline/migration.sql",
      "prisma/migrations/<ts>_auric_security/migration.sql",
      "prisma/migrations/migration_lock.toml",
    ]);
    const baseline = p.migrations[0]!.sql;
    expect(baseline).toContain("Modules: base, identity, organizations, rbac");
    expect(baseline).toContain('CREATE EXTENSION IF NOT EXISTS "citext"');
    expect(baseline).not.toMatch(/messaging_|"files"|notification|ai_conversations/);
    expect(p.migrations[1]!.sql).toContain('CREATE ROLE "auric_app"');
  });

  it("drops the Prisma back-relations to modules that are absent", () => {
    expect(read(p, "prisma/schema/identity.prisma")).not.toMatch(/notifications\s+notifications\[\]/);
    expect(read(p, "prisma/schema/organizations.prisma")).not.toMatch(/notifications\s+notifications\[\]/);
  });

  it("points the Kysely generator at the developer's own src/core", () => {
    expect(read(p, "prisma/schema/datasource.prisma")).toContain('output          = "../../src/core/kernel/db"');
  });
});

describe("generated project — full core", () => {
  let p: ScaffoldedProject;
  beforeAll(async () => {
    p = await scaffold("full", ["files", "notifications", "messaging", "assistant"]);
  }, 120_000);
  afterAll(async () => p?.cleanup());

  it("has every module's code and schema", () => {
    for (const dir of ["files", "notifications", "messaging", "assistant", "identity", "organizations", "rbac"]) {
      expect(under(p, `src/core/${dir}/`).length, dir).toBeGreaterThan(0);
    }
    expect(has(p, "prisma/schema/messaging.prisma")).toBe(true);
    expect(has(p, "src/core/tests/core.integration.test.ts")).toBe(true);
  });

  it("wires everything and keeps email verification ON", () => {
    const app = read(p, "src/core/app.module.ts");
    for (const m of ["FilesModule", "NotificationsModule", "MessagingModule"]) expect(app, m).toContain(m);
    expect(read(p, "src/core/identity/identity.module.ts")).toContain("{ provide: REQUIRE_EMAIL_VERIFICATION, useValue: true },");
    expect(read(p, "src/core/bootstrap/seed.service.ts")).toContain("messagingPermissions");
    expect(read(p, "src/core/contracts/index.ts")).toContain("IMessagingProvider");
  });

  it("keeps the notification back-relations, and has every dependency", () => {
    expect(read(p, "prisma/schema/identity.prisma")).toMatch(/notifications\s+notifications\[\]/);
    const pkg = JSON.parse(read(p, "package.json")) as { dependencies: Record<string, string> };
    for (const dep of ["socket.io", "nodemailer", "argon2"]) expect(pkg.dependencies, dep).toHaveProperty(dep);
  });

  it("keeps the business domain out of Core: no product concepts in code, schema or SQL", () => {
    // Core owns User / Organization / RBAC / Files / Messaging…; the developer's domain
    // (Property, Lead, Matter, Client, Deal…) references it and is never named here.
    const domainCode = /\b(Property|Properties|Lead|Leads|Matter|Matters|Lawyer|Lawyers|Deal|Deals|Invoice|Invoices|RealEstate|Realestate)\b/;
    const domainTables = /\b(properties|leads|matters|lawyers|deals|invoices|clients|customers|units|listings|bookings)\b/;
    const hits: string[] = [];
    for (const f of p.files.filter((x) => /\.(ts|prisma|sql|json|md)$/.test(x))) {
      const text = read(p, f);
      if (f.endsWith(".ts") && domainCode.test(text)) hits.push(`${f}: ${text.match(domainCode)![0]}`);
      if (/^prisma\//.test(f) && domainTables.test(text)) hits.push(`${f}: ${text.match(domainTables)![0]}`);
    }
    expect(hits).toEqual([]);
    expect(p.migrations.map((m) => m.sql).join("\n")).not.toMatch(domainTables);
  });

  it("has no hidden runtime dependency on AURIC: Core is source in src/core, imported through a local alias", () => {
    const pkg = JSON.parse(read(p, "package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
      expect(name, "no @auric/* or auric-* package").not.toMatch(/auric/i);
    }
    for (const f of p.files.filter((x) => x.endsWith(".ts"))) {
      expect(read(p, f), f).not.toMatch(/from ["'](@auric\/|create-auric|auric-)/);
    }
    expect(JSON.parse(read(p, "tsconfig.json")).compilerOptions.paths).toEqual({ "@core/*": ["./src/core/*"] });
    expect(read(p, "src/main.ts")).toContain('from "@core/app.module.js"');
  });

  it("records what was installed", () => {
    const lock = JSON.parse(read(p, "auric.json")) as {
      auric: { version: string; generator: string };
      requested: string[];
      modules: string[];
      features: { emailVerification: boolean };
    };
    expect(lock.auric).toEqual({ version: p.version, generator: "create-auric" });
    expect(lock.features.emailVerification).toBe(true);
    expect(lock.requested).toEqual(["assistant", "files", "messaging", "notifications"]); // canonical: sorted
    expect(lock.modules).toEqual(p.resolution.selected);
  });
});
