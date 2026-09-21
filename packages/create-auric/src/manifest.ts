import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/**
 * A scaffoldable Core module, as declared in `core/<module>/auric.module.json`.
 * The manifests are the source of truth for scaffolding: what a module owns,
 * what it needs, and what it contributes to the generated project's database,
 * wiring, environment and dependencies.
 */
const sqlSchema = z
  .object({
    /** Runs before the Prisma-generated tables (extensions, shared functions). */
    prelude: z.array(z.string()).default([]),
    /** Runs after the tables: CHECKs, triggers, partial/expression indexes. */
    constraints: z.array(z.string()).default([]),
    /** Runs at the start of the security migration: roles + grants. */
    roles: z.array(z.string()).default([]),
    /** Runs after roles: ENABLE/FORCE ROW LEVEL SECURITY + policies. */
    rls: z.array(z.string()).default([]),
  })
  .strict();

const envSchema = z
  .object({
    name: z.string().min(1),
    default: z.string().optional(),
    description: z.string().min(1),
    secret: z.boolean().default(false),
    /** Needed for the project to work at all, so `.env.example` ships it active (a secret as a CHANGE_ME placeholder). */
    required: z.boolean().default(false),
  })
  .strict();

const symbolRef = z
  .object({ symbol: z.string().min(1), from: z.string().min(1), description: z.string().optional() })
  .strict();

export const manifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    name: z.string().regex(/^[a-z][a-z0-9-]*$/),
    title: z.string().min(1),
    description: z.string().min(1),
    /** Always installed; never offered as a choice. */
    required: z.boolean().default(false),
    /** How the CLI groups the module. */
    group: z.enum(["foundation", "infrastructure"]).default("infrastructure"),
    /** Consequences shown to the developer when this module is NOT installed. */
    whenAbsent: z.array(z.string()).default([]),
    /** Source directories, relative to `core/`. */
    paths: z.array(z.string().min(1)).min(1),
    /** Single files directly under `core/` that this module owns. */
    files: z.array(z.string()).default([]),
    /** module -> why. Includes DB-level (FK) and code-level (Nest import) needs. */
    dependsOn: z.record(z.string()).default({}),
    /** Prisma schema files, relative to `prisma/schema/`. */
    prisma: z.array(z.string()),
    /** Tables this module owns — cross-checked against the Prisma `@@map`s. */
    tables: z.array(z.string()),
    sql: sqlSchema.default({}),
    /** Package names; versions come from the monorepo's package.json. */
    npm: z
      .object({
        dependencies: z.array(z.string()).default([]),
        devDependencies: z.array(z.string()).default([]),
      })
      .strict()
      .default({}),
    env: z.array(envSchema).default([]),
    /** RBAC permission catalogs the seeder registers. */
    permissions: z.array(symbolRef).default([]),
    /** Extra idempotent seeders the module contributes. */
    seed: z.array(symbolRef).default([]),
    wiring: z
      .object({ nestModules: z.array(z.string()).default([]) })
      .strict()
      .default({}),
    /** Test files/dirs copied with the module, relative to `core/`. */
    tests: z.array(z.string()).default([]),
  })
  .strict();

export type Manifest = z.infer<typeof manifestSchema> & {
  /** Absolute path of the directory holding this manifest. */
  dir: string;
};

export const MANIFEST_FILE = "auric.module.json";

/** Loads every `core/<dir>/auric.module.json`. */
export function loadManifests(coreDir: string): Manifest[] {
  const manifests: Manifest[] = [];
  for (const entry of readdirSync(coreDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(coreDir, entry.name);
    const file = join(dir, MANIFEST_FILE);
    if (!existsSync(file)) continue;

    const parsed = manifestSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
      throw new Error(`Invalid manifest ${file}:\n${issues.join("\n")}`);
    }
    manifests.push({ ...parsed.data, dir });
  }

  const seen = new Set<string>();
  for (const m of manifests) {
    if (seen.has(m.name)) throw new Error(`Duplicate module name "${m.name}"`);
    seen.add(m.name);
  }
  return manifests.sort((a, b) => a.name.localeCompare(b.name));
}
