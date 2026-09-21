# Scaffolding AURIC Core — `create-auric`

**Status: implemented and published-package-validated.** Package: `packages/create-auric/`
(engine `src/`, CLI `src/cli/`, build `scripts/build.mjs`, tests `tests/`).
Developer guide: [`create-auric.md`](create-auric.md) — this file is the architecture.

A developer runs `npx create-auric`, picks Core modules, and receives a project that **owns**
the generated code and database history. This is not a runtime npm dependency: the Core
source is copied into `src/core/` and the migrations are generated into `prisma/migrations/`.
Both are ordinary project files from that point on.

```text
Module manifests → dependency resolution → schema assembly → fresh baseline
     → module SQL (constraints, RLS) → generated project
```

Mizan and Atlas are unaffected: they keep their own migration histories and consume Core in
place. The scaffold path is additive.

## 1. Module graph

Core's modules are not independent. The dependency has two layers, and the manifests record both:

| Layer | Evidence |
|---|---|
| **Database** | `organization_members`, `user_roles`, `notifications` hold foreign keys to `users` and `organizations`. |
| **Code** | `http/SecurityModule` imports `IdentityModule` + `RbacModule`; `IdentityModule` imports `OrganizationsModule` + `RbacModule`; `FilesModule` imports `RbacModule`; `MessagingModule` imports `FilesModule`. |

```text
base ──► identity ⇄ organizations ⇄ rbac        (mutually dependent — one install unit)
files ──► rbac (+ base)
notifications ──► identity, organizations (+ base)
messaging ──► files, identity, organizations, rbac (+ base)
assistant ──► base
```

**`identity`, `organizations` and `rbac` cannot be chosen independently today.** They reference
each other (in code and in the schema), so selecting any one installs all three. `base` itself
depends on identity and rbac. The selectable features are therefore **files, notifications,
messaging, assistant**; everything else is the foundation. Splitting the foundation would
need a source refactor (see §7), not a scaffold feature.

`dependsOn` is a plain "needs" relation and may contain cycles; resolution is a closure, not a
topological sort. Every dependency carries a human reason the CLI prints ("Messaging requires
Files — message attachments reference stored files").

## 2. Manifests

`core/<module>/auric.module.json` (schema: `packages/create-auric/src/manifest.ts`).

| Field | Meaning |
|---|---|
| `name`, `title`, `description` | identity + prompt text |
| `required` | always installed (only `base`) |
| `paths` / `files` | source dirs / loose files under `core/` the module owns |
| `dependsOn` | `{ module: reason }` — DB **and** code needs |
| `prisma` / `tables` | Prisma files under `prisma/schema/` and the tables they map |
| `sql.prelude` / `constraints` / `roles` / `rls` | hand-written SQL fragments, see §4 |
| `npm` | package **names**; versions come from the monorepo `package.json` (one source of truth) |
| `env` | variables → the generated `.env.example` |
| `permissions` / `seed` | RBAC catalogs and extra seeders the module contributes |
| `wiring.nestModules` | Nest modules it adds to `AppModule` |
| `tests` | test files/dirs copied with the module |

Manifests are **verified against the code** by `tests/manifests.test.ts`: tables equal the Prisma
`@@map`s, every `core/` directory has exactly one owner, `dependsOn` covers every foreign key,
every RLS-enabled table is `FORCE`d and belongs to its module, every npm name resolves, and no
module imports another it does not depend on (outside regions). Change a module without
its manifest and a test fails.

## 3. Wiring: regions

Wiring files list every module by name. Rather than fork them into templates, the source stays
the single source of truth and marks what each module contributes:

```ts
// @auric-begin files
import { FilesModule } from "@core/files/files.module.js";
// @auric-end files
```

The generator drops regions of unselected modules and strips the markers. An `else` branch
(written as commented code) covers "module absent":

```ts
// @auric-begin notifications
{ provide: REQUIRE_EMAIL_VERIFICATION, useValue: true },
// @auric-else notifications
// { provide: REQUIRE_EMAIL_VERIFICATION, useValue: false },
// @auric-end notifications
```

Markers are comments, so Mizan/Atlas compile the files unchanged. Regions live in
`app.module.ts`, `index.ts`, `bootstrap/seed.service.ts`, `contracts/index.ts`,
`tests/helpers.ts`, `identity/identity.module.ts`.

## 4. Database strategy

**Decision: assemble the selected Prisma schemas, have Prisma generate the tables, and add each
module's hand-written SQL around it. Never copy the monorepo's migration history.**

```text
prelude.sql            citext extension, auric_set_updated_at()        (base)
Prisma diff            CREATE TABLE / indexes / FKs   ← prisma migrate diff --from-empty --to-schema (offline)
constraints.sql × N    CHECKs, triggers, partial/expression indexes    (per selected module)
─────────────────────────────  migration 1: <ts>_auric_baseline
roles.sql              auric_app (NOBYPASSRLS) / auric_system (BYPASSRLS), grants
rls.sql × N            ENABLE + FORCE ROW LEVEL SECURITY, policies     (per selected module)
─────────────────────────────  migration 2: <ts+1s>_auric_security
```

Why not the alternatives:

* **Copy the existing migrations** — they interleave Core with `lawfirm_*`, and two of them
  (`baseline`, `multitenancy_columns`) touch several modules at once and backfill legacy rows.
  Not sliceable.
* **Per-module hand-written full DDL** — duplicates what Prisma already knows and drifts; and a
  module's tables need different DDL depending on which modules are present (foreign keys).
* **Pre-generated per-module SQL slices** — splitting statements by table is fragile.

Prisma owns the *shape* (tables, columns, keys, plain indexes, FKs); the fragments own only
what Prisma's schema language cannot express. Tenancy columns are already in the schema, so
the baseline is final-state DDL with no backfill.

Fragments live in `core/<module>/scaffold/{constraints,rls}.sql` (base: `core/kernel/scaffold/
{prelude,roles}.sql`). They are extracted from the existing migrations verbatim.

### Back-relations

Prisma requires both sides of a relation, so `users` lists `notifications notifications[]`
even though the database has no such column. When `notifications` is not installed the
assembler drops that field. A **foreign key** into an unselected module is different: it is a
hard error naming the module pair (fix `dependsOn`), never silently dropped.

### RLS

The security model is preserved exactly: same roles, same `FORCE`, same policies, same grants.
Verified two ways (§6): the generated full-Core database is compared facet-by-facet to the
monorepo's migration history, and a security invariant is asserted per install set — **every
table that has an `organization_id` column is RLS-protected and has a policy**.

## 5. Existing migrations: Core vs product

| Migration | Owner | Note |
|---|---|---|
| `…_baseline` | Core (all modules) | tables for audit, events, files, identity, notifications, organizations, RBAC; also creates `citext` |
| `…_constraints_triggers_indexes` | Core (all modules) | CHECKs, `updated_at` triggers, audit immutability, outbox index |
| `…_multitenancy_columns` | Core (files, audit, notifications, events, RBAC) | **backfills** legacy rows into `org_legacy_backfill` — migration-only concern |
| `…_multitenancy_rls` | Core (all modules) | roles, grants, policies for every then-existing table |
| `…_lawfirm`, `…_lawfirm_time_and_checkin` | **Mizan** | `lawfirm_*` tables |
| `…_files_upload_status` | Core (files) | adds `status`, `committed_at` |
| `…_lawfirm_assistant` | **Mizan** *then Core* | creates `lawfirm_ai_*` … |
| `…_core_assistant_rename` | Core (assistant) | … renamed to `ai_*`; Core's assistant tables exist only via a product migration |
| `…_core_messaging` | Core (messaging) | tables + CHECKs + RLS in one file |

Atlas keeps its own copied schema folder and 13-migration history (its own realestate tables +
copies of Core's), untouched.

Filenames mislead: `_multitenancy_columns` and `_multitenancy_rls` each span several modules,
and the assistant tables are born in a *product* migration.

## 6. Validation

| Suite | What it proves | Needs |
|---|---|---|
| `regions`, `resolve`, `manifests`, `project`, `safety` | region logic; resolution + reasons; manifests match the code; what lands on disk; the public-package audit **can fail**; invalid relationships, manifests and conflicts fail clearly | — |
| `cli` | flags, name rules, existing-directory handling, the interactive flow (scripted prompts), dependency display, dynamic numbers, error format, `--verbose`, install handling, determinism | — |
| `package-content` | the **real tarball** (build → `npm pack` → extract): ships exactly CLI + engine + Core snapshot + templates; no forbidden names or content; snapshot equals its source; content hashes true; self-contained `package.json`; never reaches into the monorepo | — |
| `equivalence.integration` | generated **full-Core** baseline ≡ monorepo history on columns, constraints, indexes, triggers, policies, RLS flags, functions, grants, extensions, roles (ignoring product tables). **Drift guard** — verified to fail on a one-word change to a CHECK | Postgres |
| `matrix.integration` | per install set: exactly the selected tables, no product artifact, RLS forced on exactly the declared tables, the `organization_id` invariant, roles, a CHECK, audit immutability, and **real tenant isolation as `auric_app`** | Postgres |
| `project.e2e` (opt-in) | per install set, from the monorepo engine: types, `tsc`, the project's **own tests**, boot + `/api/health` | Postgres, `AURIC_SCAFFOLD_E2E=1` |
| `package.e2e` (opt-in) | per install set, **from the packed artifact in a clean directory**: install the tarball from the registry → `create-auric` → real `npm install` of the generated project → dependency trimming verified in `node_modules` → `tsc` → own tests → `npm run migrate` → `npm run provision-db` → tenant isolation as `auric_app` → boot → health. Also `npm exec` (the `npx` path) | Postgres, network, `AURIC_PACKAGE_E2E=1` |

Install sets exercised (every requested combination resolves to one of these six):
foundation (`base`+identity+organizations+rbac) · +files · +notifications · +messaging(+files) · +assistant · full.

```bash
npx vitest run packages/create-auric                                     # everything except the opt-in e2e suites
AURIC_SCAFFOLD_E2E=1 npx vitest run packages/create-auric/tests/project.e2e
AURIC_PACKAGE_E2E=1  npx vitest run packages/create-auric/tests/package.e2e
AURIC_PACKAGE_E2E=1 AURIC_PACKAGE_E2E_ONLY=messaging npx vitest run …    # one install set
```

## 7. Edge cases and open decisions

1. **Foundation is not splittable** (§1). "Base only / +Identity / +Organizations / +RBAC" all
   resolve to one set. Splitting needs `SecurityModule` and `IdentityService` to take their
   organization/permission providers optionally — a Core refactor with its own tenancy-risk review.
2. **Email verification depends on Notifications.** Login requires a verified email and only
   Notifications sends it. Without it the scaffold sets `REQUIRE_EMAIL_VERIFICATION=false`
   (else-branch region). Password-reset email likewise needs Notifications.
3. **Config is one monolithic zod schema** (`kernel/config.ts`) — unselected modules' env vars
   remain parseable with harmless defaults; only `.env.example` is trimmed.
4. **`migrate.ts` located the Prisma project via a fixed `../../..`.** That breaks under
   `src/core/`. Fixed: it now searches upward for `prisma.config.ts` (same result for
   Mizan/Atlas/`dist`).
5. **`prisma migrate diff` prints nothing (exit 0) when the config has no datasource.** The
   engine always supplies a placeholder one; it is never connected to.
6. **Prisma NOT NULL naming.** Postgres 18 lists NOT NULL as named constraints; a renamed table
   keeps its old names. The equivalence check compares nullability through columns instead.
7. **Product names.** Core's source comments and tests were scrubbed of product names; the one
   runtime leak (an OpenAPI tag naming a product) sits in a `product-*` region that the package
   build removes. The monorepo's module READMEs are design notes about its products and are **not
   shipped** — a generated project documents its modules from the manifests (`src/core/README.md`).
8. **npm's install-scripts policy.** Newer npm versions report dependency install scripts
   (`argon2`, `@prisma/engines`, `@swc/core`, `esbuild`) as "not yet covered by allowScripts".
   Today that is a warning; `package.e2e` asserts the native `argon2` module really built in a
   fresh install so a future default-deny is caught immediately.
9. **Windows.** Tests link `node_modules` with a junction and clean it with `rmdir`; a
   recursive delete must never follow it.

## 8. Maintaining this

* **Add or change a table** — edit `prisma/schema/<module>.prisma` *and* the module's `tables`.
* **Add a CHECK / trigger / partial index / policy** — add it to the module's `scaffold/*.sql`
  **and** to a monorepo migration. `equivalence.integration` fails until both agree.
* **Add a dependency between modules** — add it to `dependsOn` with a reason;
  `manifests.test.ts` fails if a foreign key or import needs it.
* **Add a module** — new `auric.module.json`, `scaffold/` fragments, regions in the wiring
  files, and add it to the test matrices.

## 9. The published package

```text
AURIC monorepo ─► build.mjs ─► tsc → dist/  +  Core snapshot → assets/  ─► audit ─► npm pack
```

The package is **self-contained**: `create-auric` carries a versioned *snapshot* of the Core it
generates from, so `npx create-auric` works on a machine that has never seen this repository.

| Ships | From |
|---|---|
| `dist/`, `bin/` | the compiled CLI + engine |
| `assets/core/` | each module's source, tests, SQL fragments and `auric.module.json` (READMEs and generated types excluded; `product-*` regions removed) |
| `assets/prisma/schema/` | only the Prisma files the manifests name — never a product schema |
| `assets/scripts/`, `assets/package.json` | migrate/provision/build scripts and the dependency **versions table** (only packages some manifest lists) |
| `assets/SNAPSHOT.json` | a sha256 per snapshot file, so a build is verifiable and reproducible |
| `templates/` | tsconfig, vitest config, `main.ts`, the Prisma datasource… |

`build.mjs` is a hard gate. After snapshotting it (1) validates every manifest, (2) proves the
snapshot satisfies its own manifests (every path, fragment, schema and test they name exists), and
(3) runs the **audit** (`src/audit.ts`) over everything that would ship, refusing to build if it
finds product or demo names, secrets (Groq/AWS/JWT/private keys), `.env` files, machine paths or
deployment hostnames. The same audit runs on every generated project, and again over the extracted
tarball in `package-content.test.ts`.

`prepack` runs the build, so `npm pack` / `npm publish` always ship a fresh, audited snapshot.
The dev/test seam `AURIC_ASSETS_DIR` points the CLI at another snapshot (the monorepo root works,
because the snapshot deliberately mirrors its layout); a normal install never uses it.

## 10. Versioning and reproducibility

* The generated project records the generator's version in `auric.json` →
  `{ "auric": { "version": "<create-auric version>", "generator": "create-auric" } }`, read from the
  snapshot's `package.json` at generation time. There is no update mechanism (yet); the record is
  there for whatever tooling comes later.
* **Same version + same selection ⇒ byte-identical project.** The selection is a set (sorted), the
  baseline migration carries a fixed timestamp (`20260101000000`; migrations you add later are
  stamped with the real time and always sort after it), and nothing depends on the working
  directory, the machine or the network. `cli.test.ts` asserts it.

## 11. The CLI

`src/cli/` — `args.ts` (dependency-free parser), `validate.ts` (names, existing directories),
`ui.ts` (pure functions from data to lines: help, module choices, dependency tree, summary,
progress labels, success, errors), `render.ts` (a live `@clack/prompts` renderer and a plain-stream
one that draws the same rail), `run.ts` (the flow), `main.ts` (process wiring).

* **Nothing about a module is repeated in the CLI.** Names, descriptions, the foundation/optional
  split, dependency reasons and "when absent" notes all come from the manifests.
* **Errors answer three questions** — what happened, why, what to do next (`src/errors.ts`). Stack
  traces appear only with `--verbose`. Codes: `INVALID_NAME`, `DIR_EXISTS`, `UNKNOWN_MODULE`,
  `MANIFEST_INVALID`, `SCHEMA_CLOSURE`, `PRISMA_FAILED`, `FS_FAILED`, `INSTALL_FAILED`, `USAGE`,
  `UNEXPECTED`. Failure removes anything the run wrote; a failed dependency install keeps the project.
* **Typed queries at scaffold time.** `prisma-kysely` ships with the CLI; Prisma finds generators
  by name on `PATH`, so a one-process shim pointing at the bundled copy is put on `PATH` while
  `prisma generate` runs. The generated project has `src/core/kernel/db/schema.ts` immediately.
* **Output validation.** Before handing over, the generated tree is checked: no unresolved region
  markers, valid `package.json`, a schema Prisma accepts, and the same forbidden-content audit.
