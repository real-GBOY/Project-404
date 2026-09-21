import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, relative } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { scanForForbidden } from "./audit.js";
import { assembleMigrations, prismaBaselineSql, rlsTables, runPrisma, validatePrismaSchema, type GeneratedMigration } from "./database.js";
import { trackDir } from "./cleanup.js";
import { defaultDatabaseName } from "./dbname.js";
import { AuricError } from "./errors.js";
import { loadManifests, type Manifest } from "./manifest.js";
import { applyRegions } from "./regions.js";
import { absentNotes, resolveSelection, type Resolution } from "./resolve.js";
import { assembleSchema } from "./schema.js";

const TEMPLATES = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");
const require = createRequire(import.meta.url);

/**
 * The baseline migration's name prefix. Fixed on purpose: the same CLI version and the
 * same selection must produce byte-identical output. Any migration the developer adds
 * later is stamped with the real time, so it always sorts after this one.
 */
export const BASELINE_AT = new Date("2026-01-01T00:00:00Z");

export type StageId = "resolve" | "schema" | "baseline" | "security" | "source" | "config" | "types" | "validate";

export interface StageEvent {
  id: StageId;
  state: "start" | "done";
}

export interface GenerateOptions {
  /** Directory holding `core/`, `prisma/schema/`, `scripts/` and `package.json` — the monorepo in development, the bundled snapshot when published. */
  repoRoot: string;
  outDir: string;
  projectName: string;
  /** The modules the developer chose (dependencies are added automatically). */
  modules: string[];
  /** Migration timestamp; defaults to {@link BASELINE_AT}. */
  at?: Date;
  /** Generate `src/core/kernel/db/schema.ts` (needs `prisma-kysely`, which ships with this package). Default true. */
  kyselyTypes?: boolean;
  /** Progress callback for the CLI. */
  onStage?: (event: StageEvent) => void;
}

export interface GenerateStats {
  modules: number;
  tables: number;
  rlsTables: number;
  envVars: number;
  migrations: number;
}

export interface GenerateResult {
  outDir: string;
  resolution: Resolution;
  manifests: Manifest[];
  migrations: GeneratedMigration[];
  stats: GenerateStats;
  /** Consequences of modules that were NOT installed (from their manifests' `whenAbsent`). */
  notes: string[];
  /** The AURIC version that generated the project. */
  version: string;
  /** Every file written, relative to `outDir`, sorted. */
  files: string[];
}

const SKIP_DIRS = new Set(["tests", "scaffold", "node_modules"]);
/** Written by `prisma generate` from the assembled schema — never copied from the source. */
const GENERATED = new Set(["kernel/db/schema.ts"]);

/** Copies `src` → `dest` recursively, applying regions to `.ts` files. */
function copyTree(src: string, dest: string, selected: ReadonlySet<string>, root: string, skipDirs = SKIP_DIRS): void {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    const rel = relative(root, from).split("\\").join("/");
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      copyTree(from, to, selected, root, skipDirs);
    } else {
      // Module READMEs describe the monorepo; the generated project documents its modules itself.
      if (entry.name === "auric.module.json" || entry.name === "README.md" || GENERATED.has(rel)) continue;
      copyFile(from, to, selected);
    }
  }
}

function copyFile(from: string, to: string, selected: ReadonlySet<string>): void {
  mkdirSync(dirname(to), { recursive: true });
  if (from.endsWith(".ts")) {
    writeFileSync(to, applyRegions(readFileSync(from, "utf8"), selected, from));
  } else {
    cpSync(from, to);
  }
}

function copyTests(coreDir: string, outCore: string, manifest: Manifest, selected: ReadonlySet<string>): void {
  for (const rel of manifest.tests) {
    const from = join(coreDir, rel);
    if (!existsSync(from)) throw new Error(`Module "${manifest.name}" lists test path ${rel}, which does not exist`);
    if (statSync(from).isDirectory()) copyTree(from, join(outCore, rel), selected, from, new Set(["node_modules"]));
    else copyFile(from, join(outCore, rel), selected);
  }
}

interface PackageJson {
  name?: string;
  version?: string;
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function versionOf(rootPkg: PackageJson, name: string): string {
  const version = rootPkg.dependencies?.[name] ?? rootPkg.devDependencies?.[name];
  if (!version) throw new Error(`No version for "${name}" in the package versions table`);
  return version;
}

function projectPackageJson(name: string, manifests: readonly Manifest[], rootPkg: PackageJson): string {
  const pick = (kind: "dependencies" | "devDependencies") =>
    Object.fromEntries(
      [...new Set(manifests.flatMap((m) => m.npm[kind]))].sort().map((dep) => [dep, versionOf(rootPkg, dep)]),
    );

  return `${JSON.stringify(
    {
      name,
      version: "0.1.0",
      private: true,
      type: "module",
      engines: rootPkg.engines,
      scripts: {
        dev: "node --watch --import @swc-node/register/esm-register src/main.ts",
        serve: "node --import @swc-node/register/esm-register src/main.ts",
        build: "node scripts/build.mjs",
        start: "node dist/main.js",
        migrate: "node --import @swc-node/register/esm-register scripts/migrate.ts up",
        "migrate:status": "node --import @swc-node/register/esm-register scripts/migrate.ts status",
        "migrate:dev": "prisma migrate dev",
        "provision-db": "node --import @swc-node/register/esm-register scripts/provision-db.ts",
        "db:generate": "prisma generate",
        typecheck: "tsc --noEmit",
        test: "vitest run",
        "test:watch": "vitest",
      },
      dependencies: pick("dependencies"),
      devDependencies: pick("devDependencies"),
    },
    null,
    2,
  )}\n`;
}

function envExample(manifests: readonly Manifest[], dbName: string): string {
  const blocks = manifests
    .filter((m) => m.env.length > 0)
    .map((m) => {
      const lines = m.env.map((e) => {
        const base = e.default ?? (e.required && e.secret ? "CHANGE_ME" : "");
        // A per-project database: a shared default name would collide with any other AURIC database.
        const value = e.name === "AURIC_DATABASE_URL" ? base.replace(/\/auric$/, `/${dbName}`) : base;
        const line = `${e.name}=${value}`;
        // Anything without a default that the project does not NEED ships commented out, secrets included: an active
        // `AURIC_SMTP_URL=CHANGE_ME` is not "unset" — Core would try to use it (nodemailer parses it as a URL, the
        // R2 tests treat it as credentials) instead of falling back to log-only email / local disk.
        const active = e.default !== undefined || e.required;
        return `# ${e.description}\n${active ? line : `# ${line}`}`;
      });
      return `# ── ${m.title} ${"─".repeat(Math.max(4, 60 - m.title.length))}\n${lines.join("\n")}`;
    });
  return `# Copy to .env and adjust. Only the variables of the modules you installed are listed.\n\n${blocks.join("\n\n")}\n`;
}

/** Rewrites the `databaseUrl` fallback in the generated `kernel/config.ts` to the project's own database. */
function pointDatabaseFallbackAtProject(outCore: string, dbName: string): void {
  const file = join(outCore, "kernel", "config.ts");
  const source = readFileSync(file, "utf8");
  const fallback = 'localhost:5432/auric"';
  if (!source.includes(fallback)) throw new Error("kernel/config.ts has no default database URL to point at the project");
  writeFileSync(file, source.replace(fallback, `localhost:5432/${dbName}"`));
}

const nameOf = (all: readonly Manifest[], id: string) => all.find((m) => m.name === id)?.title ?? id;

/** `src/core/README.md` — what is installed, derived from the manifests (the monorepo's own module READMEs are not shipped). */
function coreReadme(manifests: readonly Manifest[]): string {
  const sections = manifests.map((m) => {
    const deps = Object.entries(m.dependsOn).filter(([d]) => d !== "base");
    const perms = m.permissions.map((p) => `\`${p.symbol}\``).join(", ");
    return [
      `## ${m.title}`,
      "",
      m.description,
      "",
      `- **Source:** ${m.paths.map((p) => `\`${p}/\``).join(", ")}`,
      `- **Tables:** ${m.tables.map((t) => `\`${t}\``).join(", ")}`,
      ...(deps.length ? [`- **Works with:** ${deps.map(([d, why]) => `${nameOf(manifests, d)} (${why})`).join(", ")}`] : []),
      ...(perms ? [`- **Permission catalogs:** ${perms}`] : []),
      ...(m.env.length ? [`- **Environment:** ${m.env.map((e) => `\`${e.name}\``).join(", ")}`] : []),
    ].join("\n");
  });
  return `# Core

This directory is AURIC Core, generated for this project. **It is your code**: read it, change it,
delete what you do not need. Nothing here is fetched from anywhere at runtime.

Your business domain does *not* belong in here — put it beside Core (for example \`src/domain/\`)
and reference Core's tables (\`organizations\`, \`users\`, …) from your own Prisma models.

${sections.join("\n\n")}
`;
}

function projectReadme(name: string, resolution: Resolution, manifests: readonly Manifest[], notes: readonly string[]): string {
  const db = defaultDatabaseName(name);
  const rows = manifests.map((m) => `- **${m.title}** — ${m.description}`).join("\n");
  const noteBlock = notes.length
    ? `\n## Good to know\n\n${notes.map((n) => `- ${n}`).join("\n")}\n`
    : "";
  return `# ${name}

Generated by \`create-auric\`. **Everything here is yours.** The Core source in \`src/core/\` and the
database migrations in \`prisma/migrations/\` are ordinary project files — edit, extend or delete
them. There is no \`@auric/core\` package to install or keep up to date.

## Installed modules

${rows}
${noteBlock}
## Quick start

You need **Node.js 22.12+** and a running **PostgreSQL** you can create a database in.

**1. Create a new, empty database.** This is the step people trip on.

\`\`\`bash
createdb ${db}
# no createdb on your PATH? use psql:  psql -U postgres -c "CREATE DATABASE ${db}"
\`\`\`

The migrations create every table themselves, so the database must be **empty and used by nothing else** —
not another AURIC project, not an old copy of this one. Pointing at a database that already has AURIC's
tables fails with \`relation "audit_logs" already exists\` (see Troubleshooting).

**2. Configure.**

\`\`\`bash
cp .env.example .env
\`\`\`

\`AURIC_DATABASE_URL\` already points at \`${db}\` on \`localhost:5432\` as \`postgres\`/\`postgres\`. Change it if
your PostgreSQL uses a different user, password or port.

**3. Install, migrate, run.**

\`\`\`bash
npm install          # skip if create-auric already ran it
npm run migrate      # creates the tables, indexes and row-level-security policies
npm run dev          # starts the API on http://localhost:3000
\`\`\`

**4. Check it works.** Open <http://localhost:3000/api/health> — it should answer \`ok\`.
The interactive API reference is at <http://localhost:3000/api/docs>.

**5. Turn row-level security on** (do this before you put real data in). Until you do, the app connects
as the schema owner, which bypasses tenant isolation.

\`\`\`bash
npm run provision-db   # gives the auric_app and auric_system roles a login
\`\`\`

Then set \`AURIC_APP_DATABASE_URL\` and \`AURIC_SYSTEM_DATABASE_URL\` in \`.env\` to those two roles
(same host and database, user \`auric_app\` / \`auric_system\`, the passwords you set in \`.env\`) and restart.

## How Core works

- **Tenants.** An *organization* is a tenant. Every tenant-scoped table has an \`organization_id\`, and
  PostgreSQL row-level security filters every query to the caller's active organization — even if your
  code forgets a \`WHERE\`. The app queries as \`auric_app\`, which cannot bypass those policies.
- **Sign-in.** \`POST /api/auth/register\`, \`POST /api/auth/login\` (returns an access and a refresh token),
  \`POST /api/auth/refresh\`. Send \`Authorization: Bearer <accessToken>\` on protected routes.
  \`GET /api/me\` returns the signed-in user. Create an organization with \`POST /api/organizations\`, then
  \`refresh\` to switch into it.
- **Permissions.** Guard a route with \`@RequirePermission("read", "property")\`. Roles and permissions are
  seeded on boot from each module's catalog in \`src/core/*/permissions/\`; an \`admin\` role holds all of them.
- **Where things live.** Each module is \`src/core/<module>/\` (\`api/\` controllers, \`application/\` services,
  \`domain/\`, \`infrastructure/\` repositories). \`src/core/README.md\` lists what is installed.
  Put your own code **beside** Core, for example \`src/domain/\` — never inside it.

## Building your product

- Add Prisma models in \`prisma/schema/\` (give tenant-scoped tables an \`organization_id\`) and create a migration
  with \`npm run migrate:dev -- --name <change>\`. Add \`ENABLE\` + \`FORCE ROW LEVEL SECURITY\` and a
  \`tenant_isolation\` policy for each tenant table — copy the pattern from \`prisma/migrations/*_auric_security\`.
- Regenerate the typed query interface after any schema change: \`npm run db:generate\`.
- Register your permissions and Nest modules alongside Core's in \`src/core/app.module.ts\` and
  \`src/core/bootstrap/seed.service.ts\`.

## Troubleshooting

| You see | Cause and fix |
| --- | --- |
| \`relation "audit_logs" already exists\` (P3018 / 42P07) | \`AURIC_DATABASE_URL\` points at a database that already has tables. Create a fresh empty database (Quick start, step 1) and point the URL at it. If Prisma recorded a failed migration in a database you want to keep, clear that record with \`npx prisma migrate resolve --rolled-back <migration name from the error>\`. |
| \`database "${db}" does not exist\` | Run step 1, or change the database name in \`AURIC_DATABASE_URL\`. |
| \`password authentication failed\` / \`ECONNREFUSED\` | PostgreSQL isn't running, or the user, password or port in \`AURIC_DATABASE_URL\` is wrong. |
| Boot refuses the JWT secret | In production set \`AURIC_JWT_SECRET\` to a long random value; the dev default is rejected. |
| Row-level security is not enforced | Run \`npm run provision-db\` and set the two role URLs (Quick start, step 5). |
| \`npm run migrate:status\` | Shows which migrations are applied. |

Installed: ${resolution.selected.join(", ")}.
`;
}

/** Per-module SQL fragment names embedded in the migration are documented by the migration files themselves. */
function readVersion(rootPkg: PackageJson): string {
  if (!rootPkg.version) throw new Error("The package versions table has no version");
  return rootPkg.version;
}

const stage = (opts: GenerateOptions, id: StageId) => ({
  start: () => opts.onStage?.({ id, state: "start" }),
  done: () => opts.onStage?.({ id, state: "done" }),
});

/**
 * Scaffolds a project from the selected modules. Pure file generation plus Prisma's
 * offline schema tooling — it never installs dependencies and never touches a database.
 */
export async function generateProject(opts: GenerateOptions): Promise<GenerateResult> {
  const { repoRoot, outDir, projectName } = opts;
  const coreDir = join(repoRoot, "core");
  const prismaDir = join(repoRoot, "prisma", "schema");
  const rootPkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as PackageJson;
  const version = readVersion(rootPkg);

  let s = stage(opts, "resolve");
  s.start();
  const all = loadManifests(coreDir);
  const resolution = resolveSelection(all, opts.modules);
  const manifests = resolution.selected.map((n) => all.find((m) => m.name === n)!);
  const selected = new Set(resolution.selected);
  const notes = absentNotes(all, resolution.selected);
  s.done();

  s = stage(opts, "schema");
  s.start();
  const schema = assembleSchema(prismaDir, all, resolution.selected);
  const schemaOut = join(outDir, "prisma", "schema");
  mkdirSync(schemaOut, { recursive: true });
  for (const f of schema.files) writeFileSync(join(schemaOut, f.name), f.content);
  cpSync(join(TEMPLATES, "datasource.prisma"), join(schemaOut, "datasource.prisma"));
  s.done();

  s = stage(opts, "baseline");
  s.start();
  const tablesSql = await prismaBaselineSql(schemaOut);
  s.done();

  s = stage(opts, "security");
  s.start();
  const migrations = assembleMigrations({ coreDir, manifests, tablesSql, at: opts.at ?? BASELINE_AT });
  for (const m of migrations) {
    const dir = join(outDir, "prisma", "migrations", m.name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "migration.sql"), m.sql);
  }
  writeFileSync(
    join(outDir, "prisma", "migrations", "migration_lock.toml"),
    '# Please do not edit this file manually\n# It should be added in your version-control system (e.g., Git)\nprovider = "postgresql"\n',
  );
  s.done();

  s = stage(opts, "source");
  s.start();
  const outCore = join(outDir, "src", "core");
  for (const m of manifests) {
    for (const p of m.paths) copyTree(join(coreDir, p), join(outCore, p), selected, coreDir);
    for (const f of m.files) copyFile(join(coreDir, f), join(outCore, f), selected);
    copyTests(coreDir, outCore, m, selected);
  }
  writeFileSync(join(outCore, "README.md"), coreReadme(manifests));
  s.done();

  s = stage(opts, "config");
  s.start();
  const put = (rel: string, content: string) => {
    mkdirSync(dirname(join(outDir, rel)), { recursive: true });
    writeFileSync(join(outDir, rel), content);
  };
  const template = (file: string) => readFileSync(join(TEMPLATES, file), "utf8");
  put("package.json", projectPackageJson(projectName, manifests, rootPkg));
  put("tsconfig.json", template("tsconfig.json"));
  put("tsconfig.build.json", template("tsconfig.build.json"));
  put(".swcrc", template("swcrc"));
  put("vitest.config.ts", template("vitest.config.ts"));
  put("prisma.config.ts", template("prisma.config.ts"));
  put(".gitignore", template("gitignore"));
  put("src/main.ts", template("main.ts").replaceAll("{{name}}", projectName));
  for (const script of ["migrate.ts", "provision-db.ts", "build.mjs"]) {
    put(`scripts/${script}`, readFileSync(join(repoRoot, "scripts", script), "utf8"));
  }
  put(".env.example", envExample(manifests, defaultDatabaseName(projectName)));
  // Core falls back to a hard-coded database URL when no .env exists. In a generated project that fallback must
  // be THIS project's database, never a shared `auric`: a forgotten .env would otherwise run migrations against
  // (and leave a failed-migration record in) whatever AURIC database happens to be on the machine.
  pointDatabaseFallbackAtProject(outCore, defaultDatabaseName(projectName));
  put("README.md", projectReadme(projectName, resolution, manifests, notes));
  put(
    "auric.json",
    `${JSON.stringify(
      {
        auric: { version, generator: "create-auric" },
        requested: resolution.requested,
        modules: resolution.selected,
        features: { emailVerification: selected.has("notifications") },
      },
      null,
      2,
    )}\n`,
  );
  s.done();

  if (opts.kyselyTypes !== false) {
    s = stage(opts, "types");
    s.start();
    await generateKyselyTypes(outDir);
    s.done();
  }

  s = stage(opts, "validate");
  s.start();
  await validateProject(outDir, { projectName });
  s.done();

  const stats: GenerateStats = {
    modules: resolution.selected.length,
    tables: manifests.reduce((n, m) => n + m.tables.length, 0),
    rlsTables: rlsTables(coreDir, manifests).length,
    envVars: manifests.reduce((n, m) => n + m.env.length, 0),
    migrations: migrations.length,
  };

  return { outDir, resolution, manifests, migrations, stats, notes, version, files: listFiles(outDir) };
}

/**
 * Checks the generated tree before handing it over: no leftover region markers, a
 * schema Prisma accepts, and nothing that looks like a product, demo asset, secret
 * or machine path. A failure here is a bug in the generator, never the developer's fault.
 */
export async function validateProject(projectDir: string, opts: { projectName?: string } = {}): Promise<void> {
  const problems: string[] = [];

  for (const f of listFiles(projectDir)) {
    if (f.endsWith(".ts") && /@auric-(begin|else|end)/.test(readFileSync(join(projectDir, f), "utf8"))) {
      problems.push(`${f}: a module region marker was not resolved`);
    }
  }
  try {
    JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
  } catch {
    problems.push("package.json is not valid JSON");
  }
  try {
    await validatePrismaSchema(join(projectDir, "prisma", "schema"));
  } catch (err) {
    problems.push(`prisma schema is invalid: ${(err as Error).message}`);
  }
  // The project name is the developer's choice and appears in package.json, README.md and main.ts:
  // a project called `demo-app` or `atlas-crm` must not be mistaken for a leaked product name. The database
  // name derived from it (`atlas_crm`, in .env.example and the README) is the same word.
  for (const f of scanForForbidden(projectDir, {
    skipContent: /^node_modules\//,
    allow: opts.projectName ? [opts.projectName, defaultDatabaseName(opts.projectName)] : [],
  })) {
    problems.push(`${f.file}: ${f.rule} (${f.detail})`);
  }

  if (problems.length > 0) {
    throw new AuricError(
      "UNEXPECTED",
      "The generated project failed its own validation.",
      problems.map((p) => `- ${p}`).join("\n"),
      "This is a bug in create-auric, not in your setup. Please report it.",
    );
  }
}

function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? e.name === "node_modules"
          ? []
          : listFiles(join(dir, e.name), base)
        : [relative(base, join(dir, e.name)).split("\\").join("/")],
    )
    .sort();
}

/**
 * Writes `src/core/kernel/db/schema.ts` — the Kysely `Database` interface for exactly
 * the tables of the installed modules — so the project is fully typed the moment it is
 * written, before any `npm install`.
 *
 * The generator (`prisma-kysely`) ships with this package. Prisma finds generators by
 * name on `PATH`, so a one-process shim pointing at our copy is put on `PATH` for the
 * duration of the call; the project's own `datasource.prisma` keeps the plain
 * `prisma-kysely` provider for when the developer regenerates after an install.
 */
export async function generateKyselyTypes(projectDir: string): Promise<void> {
  const work = mkdtempSync(join(tmpdir(), "auric-kysely-"));
  const release = trackDir(work);
  try {
    const schemaDir = join(work, "schema");
    mkdirSync(schemaDir);
    const projectSchema = join(projectDir, "prisma", "schema");
    for (const f of readdirSync(projectSchema)) {
      if (f.endsWith(".prisma") && f !== "datasource.prisma") cpSync(join(projectSchema, f), join(schemaDir, f));
    }

    const output = join(projectDir, "src", "core", "kernel", "db").split("\\").join("/");
    const template = readFileSync(join(projectSchema, "datasource.prisma"), "utf8");
    const pinned = template.replace(/^(\s*output\s*=\s*).*$/m, `$1"${output}"`);
    if (pinned === template) throw new Error("datasource.prisma has no generator output to redirect");
    writeFileSync(join(schemaDir, "datasource.prisma"), pinned);

    const bin = join(work, "bin");
    mkdirSync(bin);
    const kyselyBin = require.resolve("prisma-kysely/bin");
    if (process.platform === "win32") {
      writeFileSync(join(bin, "prisma-kysely.cmd"), `@echo off\r\n"${process.execPath}" "${kyselyBin}" %*\r\n`);
    } else {
      const shim = join(bin, "prisma-kysely");
      writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" "${kyselyBin}" "$@"\n`);
      chmodSync(shim, 0o755);
    }

    const config = join(work, "prisma.config.mjs");
    writeFileSync(
      config,
      `export default { schema: ${JSON.stringify(schemaDir)}, datasource: { url: "postgresql://offline:offline@localhost:5432/offline" } };\n`,
    );

    // On Windows the variable is `Path`; overwriting only `PATH` would leave two keys behind.
    const pathKey = Object.keys(process.env).find((k) => k.toLowerCase() === "path") ?? "PATH";
    await runPrisma(["generate", "--config", config], {
      cwd: tmpdir(),
      env: { [pathKey]: `${bin}${delimiter}${process.env[pathKey] ?? ""}` },
    });

    if (!existsSync(join(projectDir, "src", "core", "kernel", "db", "schema.ts"))) {
      throw new Error("prisma generate did not write src/core/kernel/db/schema.ts");
    }
  } finally {
    rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    release();
  }
}
