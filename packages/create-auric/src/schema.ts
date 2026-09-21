import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Manifest } from "./manifest.js";

export interface ModelInfo {
  model: string;
  /** The table name (`@@map`), falling back to the model name. */
  table: string;
  file: string;
  /**
   * Models this model owns a foreign key to (`@relation(fields: [...])`). A hard
   * dependency: the referenced module MUST be installed, and must appear in the
   * owning module's `dependsOn`.
   */
  references: string[];
  /**
   * Models this model merely lists the inverse side of (e.g. `users.notifications`).
   * Prisma requires the field, but the database has no column for it, so it can be
   * dropped when the other module is not installed.
   */
  backReferences: string[];
}

/** `  field_name  TypeName[]?  @attrs…` — the only field shape these schemas use. */
const FIELD = /^(\s+)(\w+)\s+(\w+)(\[\])?(\?)?(\s.*)?$/;

/** Parses model names, `@@map` tables and inter-model field types out of one `.prisma` file. */
export function parsePrismaModels(file: string, content: string, universe: ReadonlySet<string>): ModelInfo[] {
  const models: ModelInfo[] = [];
  let current: { model: string; table: string; references: Set<string>; backReferences: Set<string> } | undefined;

  for (const raw of content.split(/\r?\n/)) {
    const line = raw.replace(/\/\/.*$/, "");
    if (!line.trim()) continue;

    const open = /^model\s+(\w+)\s*\{$/.exec(line.trim());
    if (open) {
      current = { model: open[1]!, table: open[1]!, references: new Set(), backReferences: new Set() };
      continue;
    }
    if (!current) continue;
    if (line.trim() === "}") {
      models.push({
        model: current.model,
        table: current.table,
        file,
        references: [...current.references].sort(),
        backReferences: [...current.backReferences].sort(),
      });
      current = undefined;
      continue;
    }

    const map = /@@map\("([^"]+)"\)/.exec(line);
    if (map) current.table = map[1]!;
    if (line.trim().startsWith("@@")) continue;

    const field = FIELD.exec(line);
    const type = field?.[3];
    if (type && type !== current.model && universe.has(type)) {
      (line.includes("fields:") ? current.references : current.backReferences).add(type);
    }
  }
  return models;
}

export class SchemaClosureError extends Error {}

export interface AssembledSchema {
  /** Files to write into the project's `prisma/schema/` (datasource excluded). */
  files: Array<{ name: string; content: string }>;
  models: ModelInfo[];
  /** Back-relation fields removed because their target module is not installed. */
  droppedBackRelations: Array<{ model: string; field: string; target: string }>;
}

type Universe = Map<string, ModelInfo & { module: string }>;

/** Every model across every module's Prisma files, keyed by model name. */
export function indexUniverse(prismaDir: string, manifests: readonly Manifest[]): Universe {
  // Two passes: model names first (so field-type detection knows the universe), then references.
  const files = manifests.flatMap((m) => m.prisma.map((f) => ({ module: m.name, file: f })));
  const names = new Set<string>();
  for (const { file } of files) {
    const text = readFileSync(join(prismaDir, file), "utf8");
    for (const match of text.matchAll(/^model\s+(\w+)\s*\{/gm)) names.add(match[1]!);
  }

  const index: Universe = new Map();
  for (const { module, file } of files) {
    const text = readFileSync(join(prismaDir, file), "utf8");
    for (const info of parsePrismaModels(file, text, names)) {
      if (index.has(info.model)) throw new Error(`Model "${info.model}" is defined by more than one module`);
      index.set(info.model, { ...info, module });
    }
  }
  return index;
}

/**
 * Rewrites one module's Prisma file for a selection that lacks some modules:
 * back-relation fields pointing at an unselected module's models are removed
 * (together with the `///` doc lines directly above them).
 */
function dropDanglingBackRelations(
  content: string,
  chosenModels: ReadonlySet<string>,
  universe: Universe,
  dropped: AssembledSchema["droppedBackRelations"],
): string {
  const out: string[] = [];
  let model: string | undefined;

  for (const line of content.split(/\r?\n/)) {
    const open = /^model\s+(\w+)\s*\{/.exec(line);
    if (open) model = open[1];
    else if (line.trim() === "}") model = undefined;

    const field = model ? FIELD.exec(line.replace(/\/\/.*$/, "")) : null;
    const type = field?.[3];
    if (model && type && universe.has(type) && !chosenModels.has(type) && !line.includes("fields:")) {
      dropped.push({ model, field: field![2]!, target: type });
      while (out.length > 0 && out[out.length - 1]!.trim().startsWith("///")) out.pop();
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Collects the Prisma files of the selected modules and proves the result is a
 * closed schema.
 *
 *  - A foreign key into a module that is not selected is an error (Prisma would
 *    reject it with an opaque message; this names the module pair so the
 *    manifest's `dependsOn` can be fixed).
 *  - A back-relation field into a module that is not selected is silently
 *    dropped from the assembled file — the database has nothing to drop.
 */
export function assembleSchema(
  prismaDir: string,
  manifests: readonly Manifest[],
  selected: readonly string[],
): AssembledSchema {
  const chosen = new Set(selected);
  const universe = indexUniverse(prismaDir, manifests);
  const chosenModels = new Set([...universe.values()].filter((i) => chosen.has(i.module)).map((i) => i.model));
  const models: ModelInfo[] = [];
  const problems: string[] = [];

  for (const info of universe.values()) {
    if (!chosen.has(info.module)) continue;
    models.push(info);
    for (const ref of info.references) {
      const target = universe.get(ref)!;
      if (!chosen.has(target.module)) {
        problems.push(
          `model "${info.model}" (${info.module}) has a foreign key to "${ref}" from module "${target.module}", ` +
            `which is not selected — add "${target.module}" to ${info.module}'s dependsOn`,
        );
      }
    }
  }
  if (problems.length > 0) {
    throw new SchemaClosureError(`Selected modules do not form a closed Prisma schema:\n  - ${problems.join("\n  - ")}`);
  }

  const droppedBackRelations: AssembledSchema["droppedBackRelations"] = [];
  const files = manifests
    .filter((m) => chosen.has(m.name))
    .flatMap((m) => m.prisma)
    .sort()
    .map((name) => ({
      name,
      content: dropDanglingBackRelations(readFileSync(join(prismaDir, name), "utf8"), chosenModels, universe, droppedBackRelations),
    }));

  return { files, models, droppedBackRelations };
}
