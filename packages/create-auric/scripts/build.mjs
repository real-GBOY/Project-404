// Builds the publishable package from the AURIC monorepo:
//
//   monorepo ──► tsc (dist/) ──► Core snapshot (assets/) ──► audit ──► ready to `npm pack`
//
// The published package must be self-contained: it carries a versioned SNAPSHOT of
// the Core (source, Prisma schemas, SQL fragments, manifests, scripts) so that
// `npx create-auric` works on a machine that has never seen this repository.
// Nothing at runtime reaches back into the monorepo.
//
// The audit at the end is a hard gate: if anything that must not be public (product
// code, demo data, secrets, machine paths) is in what would ship, the build fails.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(pkgDir, "..", "..");
const require = createRequire(import.meta.url);
const log = (msg) => console.log(`  ${msg}`);

const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const rootPkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

// ── 1. compile the CLI + engine ─────────────────────────────────────────────
console.log(`create-auric ${pkg.version} — building`);
rmSync(join(pkgDir, "dist"), { recursive: true, force: true });
execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", join(pkgDir, "tsconfig.build.json")], {
  stdio: "inherit",
  cwd: pkgDir,
});
log("✓ compiled to dist/");

// The engine is loaded from what we just built — the same code that ships.
const engine = await import(pathToFileURL(join(pkgDir, "dist", "index.js")).href);
const { loadManifests, removeRegions, isProductRegion, scanForForbidden, formatFindings } = engine;

// ── 2. snapshot the Core ────────────────────────────────────────────────────
const assets = join(pkgDir, "assets");
rmSync(assets, { recursive: true, force: true });
mkdirSync(assets, { recursive: true });

const manifests = loadManifests(join(repoRoot, "core")); // validates every manifest (zod)
log(`✓ ${manifests.length} module manifests valid`);

const SKIP_DIRS = new Set(["node_modules"]);
/** Written by `prisma generate` for each project's own schema — never shipped. */
const GENERATED = new Set(["kernel/db/schema.ts"]);

function copyModuleTree(src, dest, root) {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    const rel = relative(root, from).split("\\").join("/");
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) copyModuleTree(from, to, root);
      continue;
    }
    // Module READMEs are monorepo design notes; generated projects document their modules from the manifests.
    if (entry.name === "README.md" || GENERATED.has(rel)) continue;
    mkdirSync(dirname(to), { recursive: true });
    if (entry.name.endsWith(".ts")) {
      // Product-only regions (`product-*`) are removed here so they never reach the package;
      // module regions stay, for the generator to resolve per selection.
      writeFileSync(to, removeRegions(readFileSync(from, "utf8"), isProductRegion, rel));
    } else {
      copyFileSync(from, to);
    }
  }
}

const coreSrc = join(repoRoot, "core");
const coreOut = join(assets, "core");
const owned = new Set();
for (const m of manifests) {
  for (const p of m.paths) owned.add(p);
  copyFileSync(join(m.dir, "auric.module.json"), (mkdirSync(join(coreOut, relative(coreSrc, m.dir)), { recursive: true }), join(coreOut, relative(coreSrc, m.dir), "auric.module.json")));
}
for (const p of owned) copyModuleTree(join(coreSrc, p), join(coreOut, p), coreSrc);
for (const m of manifests) {
  for (const f of m.files) {
    mkdirSync(dirname(join(coreOut, f)), { recursive: true });
    writeFileSync(join(coreOut, f), removeRegions(readFileSync(join(coreSrc, f), "utf8"), isProductRegion, f));
  }
  // Loose test files under core/tests (directories were copied with their module).
  for (const t of m.tests) {
    const from = join(coreSrc, t);
    if (statSync(from).isFile() && !existsSync(join(coreOut, t))) {
      mkdirSync(dirname(join(coreOut, t)), { recursive: true });
      writeFileSync(join(coreOut, t), removeRegions(readFileSync(from, "utf8"), isProductRegion, t));
    }
  }
}
log("✓ Core source");

const schemaOut = join(assets, "prisma", "schema");
mkdirSync(schemaOut, { recursive: true });
for (const f of new Set(manifests.flatMap((m) => m.prisma))) copyFileSync(join(repoRoot, "prisma", "schema", f), join(schemaOut, f));
log("✓ Prisma schemas");

mkdirSync(join(assets, "scripts"), { recursive: true });
for (const s of ["migrate.ts", "provision-db.ts", "build.mjs"]) copyFileSync(join(repoRoot, "scripts", s), join(assets, "scripts", s));
log("✓ project scripts");

// Versions the generated package.json may use — only for packages some manifest actually lists.
//
// EXACT versions, read from what the monorepo actually has installed (its lockfile's choice), not the
// caret ranges in the root package.json. Core is tested against one specific dependency set, and some
// of it must match exactly (e.g. @nestjs/platform-fastify pins fastify; a floating `^` in a fresh
// project resolves to a newer fastify and yields two copies with incompatible types). A generated
// project therefore starts on the tested set; upgrading it is a deliberate act.
const wanted = new Set(manifests.flatMap((m) => [...m.npm.dependencies, ...m.npm.devDependencies]));
const installedVersion = (name) => {
  const file = join(repoRoot, "node_modules", name, "package.json");
  if (!existsSync(file)) {
    console.error(`✖ ${name} is listed by a module manifest but is not installed in the monorepo (run npm install).`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(file, "utf8")).version;
};
const versionsOf = (table) =>
  Object.fromEntries(
    Object.keys(table ?? {})
      .filter((n) => wanted.has(n))
      .sort((a, b) => a.localeCompare(b))
      .map((n) => [n, installedVersion(n)]),
  );
writeFileSync(
  join(assets, "package.json"),
  `${JSON.stringify(
    {
      name: "auric-core-snapshot",
      version: pkg.version,
      private: true,
      engines: rootPkg.engines,
      dependencies: versionsOf(rootPkg.dependencies),
      devDependencies: versionsOf(rootPkg.devDependencies),
    },
    null,
    2,
  )}\n`,
);

// The snapshot must satisfy its own manifests: every path, fragment, prisma file and test it names is present.
const shipped = loadManifests(join(assets, "core"));
const missing = [];
for (const m of shipped) {
  for (const p of [...m.paths, ...m.files, ...m.tests, ...Object.values(m.sql).flat()]) {
    if (!existsSync(join(assets, "core", p))) missing.push(`${m.name}: core/${p}`);
  }
  for (const f of m.prisma) if (!existsSync(join(schemaOut, f))) missing.push(`${m.name}: prisma/schema/${f}`);
}
if (missing.length > 0) {
  console.error(`✖ The snapshot is incomplete:\n${missing.map((x) => `  ${x}`).join("\n")}`);
  process.exit(1);
}
log("✓ snapshot satisfies its manifests");

copyFileSync(join(repoRoot, "LICENSE"), join(pkgDir, "LICENSE"));

// The developer guide travels with the package: a new developer needs nothing from the monorepo.
rmSync(join(pkgDir, "docs"), { recursive: true, force: true });
mkdirSync(join(pkgDir, "docs"), { recursive: true });
copyFileSync(join(repoRoot, "docs", "create-auric.md"), join(pkgDir, "docs", "create-auric.md"));
log("✓ developer guide");

// ── 3. audit everything that would ship ─────────────────────────────────────
// The audit's own compiled rules necessarily spell out the words it hunts for.
const audits = [
  ["assets", scanForForbidden(assets)],
  ["templates", scanForForbidden(join(pkgDir, "templates"))],
  ["dist", scanForForbidden(join(pkgDir, "dist"), { skipContent: /(^|\/)audit\.js$/ })],
  ["bin", scanForForbidden(join(pkgDir, "bin"))],
  // Documentation may use a generic business domain as its worked example, never a product name.
  ["docs", scanForForbidden(join(pkgDir, "docs"), { docs: /^/ })],
];
const findings = audits.flatMap(([area, list]) => list.map((f) => ({ ...f, file: `${area}/${f.file}` })));
if (findings.length > 0) {
  console.error(`✖ Refusing to package: ${findings.length} forbidden item(s) would be published:\n${formatFindings(findings)}`);
  process.exit(1);
}
log("✓ audit clean (no product code, demo data, secrets or machine paths)");

// ── 4. a content manifest, so a build is verifiable and reproducible ────────
function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else yield full;
  }
}
const hashes = {};
for (const file of [...walk(assets)].sort()) {
  const rel = relative(assets, file).split("\\").join("/");
  // Normalise line endings so a checkout on any OS yields the same digest.
  hashes[rel] = createHash("sha256").update(readFileSync(file, "utf8").replace(/\r\n/g, "\n")).digest("hex");
}
writeFileSync(join(assets, "SNAPSHOT.json"), `${JSON.stringify({ version: pkg.version, files: hashes }, null, 2)}\n`);
log(`✓ SNAPSHOT.json (${Object.keys(hashes).length} files)`);

console.log("done.");
