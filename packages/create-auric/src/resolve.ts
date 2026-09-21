import type { Manifest } from "./manifest.js";

export interface AddedDependency {
  module: string;
  /** Modules (from the developer's selection or transitively) that need it. */
  requiredBy: string[];
  /** The manifests' stated reasons, one per requiring module. */
  reasons: string[];
}

export interface Resolution {
  /** What the developer asked for (required modules excluded). */
  requested: string[];
  /** Everything that will be installed, in a stable install order: base first, then A→Z. */
  selected: string[];
  /** Selected modules the developer did not ask for, and why. Required modules are omitted. */
  added: AddedDependency[];
}

/**
 * Dependency resolution. `dependsOn` is a plain "needs" relation and is allowed
 * to contain cycles (identity ⇄ organizations ⇄ rbac genuinely reference each
 * other) — resolution is a closure, not a topological sort, so cycles are fine.
 * The install order is only for deterministic output; the database is ordered by
 * Prisma's own dependency analysis, not by this list.
 */
export function resolveSelection(manifests: readonly Manifest[], requested: readonly string[]): Resolution {
  const byName = new Map(manifests.map((m) => [m.name, m]));
  const need = (name: string, because: string): Manifest => {
    const m = byName.get(name);
    if (!m) throw new Error(`Unknown module "${name}" (required by ${because}). Known: ${[...byName.keys()].join(", ")}`);
    return m;
  };

  const required = manifests.filter((m) => m.required).map((m) => m.name);
  // A selection is a set: sorted, so the same choice always yields the same project however it was typed.
  const userAsked = [...new Set(requested)].filter((n) => !required.includes(n)).sort();
  for (const name of userAsked) need(name, "the selection");

  const selected = new Set<string>([...required, ...userAsked]);
  const requiredBy = new Map<string, Map<string, string>>();

  const queue = [...selected];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [dep, reason] of Object.entries(need(current, "the selection").dependsOn)) {
      need(dep, current);
      const reasons = requiredBy.get(dep) ?? new Map<string, string>();
      reasons.set(current, reason);
      requiredBy.set(dep, reasons);
      if (!selected.has(dep)) {
        selected.add(dep);
        queue.push(dep);
      }
    }
  }

  const order = [...selected].sort((a, b) => {
    const rank = (n: string) => (byName.get(n)!.required ? 0 : 1);
    return rank(a) - rank(b) || a.localeCompare(b);
  });

  const added: AddedDependency[] = order
    .filter((n) => !userAsked.includes(n) && !byName.get(n)!.required)
    .map((module) => {
      const who = requiredBy.get(module) ?? new Map<string, string>();
      return { module, requiredBy: [...who.keys()], reasons: [...who.values()] };
    });

  return { requested: userAsked, selected: order, added };
}

/** What the developer loses by not installing certain modules — the manifests' own `whenAbsent` notes. */
export function absentNotes(manifests: readonly Manifest[], selected: readonly string[]): string[] {
  const chosen = new Set(selected);
  return manifests.filter((m) => !chosen.has(m.name)).flatMap((m) => m.whenAbsent);
}
