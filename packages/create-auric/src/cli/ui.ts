import pc from "picocolors";
import { defaultDatabaseName } from "../dbname.js";
import type { AuricError } from "../errors.js";
import type { GenerateStats, StageId } from "../project.js";
import type { Manifest } from "../manifest.js";
import { resolveSelection, type Resolution } from "../resolve.js";

/**
 * Everything the CLI says, as pure functions from data to lines. Nothing here
 * writes to a terminal — the renderers do — so the experience is testable as
 * plain text. Module names, groupings, descriptions and dependency reasons all
 * come from the manifests; nothing about a module is repeated in this file.
 *
 * Visual language: one left rail (│) that every block hangs from, ◆ for the
 * active step, ◇ for a finished one, ✓ / ✖ / ▲ for outcomes, gold for the brand.
 */
export const TAGLINE = "Build your foundation. Own your code.";
/** Who makes it — shown beside the version in the intro and the help header. */
export const CREDIT = "by JINX";

export const gold = (s: string) => pc.bold(pc.yellow(s));
export const dim = pc.dim;
const ok = (s: string) => `${pc.green("✓")} ${s}`;

const pad = (s: string, width: number) => s + " ".repeat(Math.max(1, width - s.length));

/** Word-wraps `text` to `width` columns; continuation lines are indented by `indent`. */
export function wrap(text: string, width = 74, indent = 2): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = " ".repeat(indent) + word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const noteLines = (notes: readonly string[]) =>
  notes.flatMap((n) => wrap(n, 72, 0).map((l, i) => (i === 0 ? `${pc.yellow("▲")} ${l}` : `  ${l}`)));
const field = (label: string) => pc.bold(label.padEnd(11));

const titleOf = (all: readonly Manifest[], name: string) => all.find((m) => m.name === name)?.title ?? name;

/** Levenshtein distance — enough for "did you mean" on a handful of module names. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

/** The known module name closest to `input`, if it is plausibly a typo of it. */
export function suggestModule(input: string, known: readonly string[]): string | undefined {
  const best = known.map((k) => [k, distance(input, k)] as const).sort((x, y) => x[1] - y[1])[0];
  return best && best[1] <= Math.max(2, Math.floor(best[0].length / 3)) ? best[0] : undefined;
}

/** A manifest description trimmed to its first sentence — menu- and help-sized. */
export function shortDescription(description: string, max = 52): string {
  const first = description.split(/\.\s/)[0]!.replace(/\.$/, "");
  if (first.length <= max) return first;
  // Cut at a word boundary so a highlighted picker item stays on one line.
  const cut = first.slice(0, max + 1).replace(/[\s,;:—-]+\S*$/, "");
  return `${cut.length >= 20 ? cut : first.slice(0, max)}…`;
}

/** Modules the developer can actually choose: everything the foundation does not already include. */
export function selectableModules(manifests: readonly Manifest[]): Manifest[] {
  const always = new Set(resolveSelection(manifests, []).selected);
  return manifests.filter((m) => !always.has(m.name));
}

/** The modules every project gets (`required` plus everything they need), in install order. */
export function foundationModules(manifests: readonly Manifest[]): Manifest[] {
  const always = resolveSelection(manifests, []).selected;
  return always.map((n) => manifests.find((m) => m.name === n)!);
}

export function moduleOptions(manifests: readonly Manifest[]): Array<{ value: string; label: string; hint: string }> {
  return selectableModules(manifests).map((m) => ({ value: m.name, label: m.title, hint: shortDescription(m.description) }));
}

export function foundationLines(manifests: readonly Manifest[]): string[] {
  const list = foundationModules(manifests).map((m) => m.title).join(pc.dim(" · "));
  return [`${pc.bold("Foundation")} ${dim("(always included)")}`, `  ${list}`];
}

/**
 * "Messaging requires: Files (message attachments) …", one block per module the developer
 * chose that needs something. Foundation modules are marked as such rather than as
 * surprises; anything genuinely pulled in on their behalf is marked `added`.
 */
export function dependencyLines(resolution: Resolution, manifests: readonly Manifest[]): string[] {
  const foundation = new Set(foundationModules(manifests).map((m) => m.name));
  const wanted = new Set(resolution.requested);
  const lines: string[] = [];

  for (const name of resolution.requested) {
    const m = manifests.find((x) => x.name === name)!;
    const deps = Object.entries(m.dependsOn).filter(([d]) => d !== "base");
    if (deps.length === 0) continue;
    const width = Math.max(...deps.map(([d]) => titleOf(manifests, d).length)) + 2;
    lines.push(`${pc.bold(m.title)} requires`);
    deps.forEach(([dep, why], i) => {
      const branch = i === deps.length - 1 ? "└" : "├";
      const tag = wanted.has(dep) ? dim("selected") : foundation.has(dep) ? dim("foundation") : pc.yellow("added");
      lines.push(`  ${dim(branch)} ${pad(titleOf(manifests, dep), width)}${pad(why, 24)}${tag}`);
    });
  }
  const added = resolution.added.filter((a) => !foundation.has(a.module));
  if (added.length > 0) {
    lines.push("", `${added.map((a) => titleOf(manifests, a.module)).join(", ")} will also be installed.`);
  }
  return lines;
}

export interface SummaryInput {
  resolution: Resolution;
  manifests: readonly Manifest[];
  notes: readonly string[];
  install: boolean;
}

export function summaryLines({ resolution, manifests, notes, install }: SummaryInput): string[] {
  const found = new Set(foundationModules(manifests).map((m) => m.name));
  const chosen = resolution.selected.filter((n) => !found.has(n));
  const list = (names: string[]) => names.map((n) => `  ${ok(titleOf(manifests, n))}`);
  return [
    pc.bold("Foundation"),
    ...list(resolution.selected.filter((n) => found.has(n))),
    ...(chosen.length ? ["", pc.bold("Modules"), ...list(chosen)] : []),
    "",
    `${field("Database")}PostgreSQL ${dim("(row-level security requires it)")}`,
    `${field("Migrations")}${ok("baseline")}  ${ok("security")}`,
    `${field("Install")}${install ? "dependencies will be installed" : dim("skipped")}`,
    ...(notes.length ? ["", ...noteLines(notes)] : []),
  ];
}

export const STAGE_LABELS: Record<StageId, string> = {
  resolve: "Resolving modules",
  schema: "Assembling schemas",
  baseline: "Generating Prisma baseline",
  security: "Applying security SQL",
  source: "Preparing source",
  config: "Preparing configuration",
  types: "Generating typed queries",
  validate: "Validating output",
};

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export function detectPackageManager(userAgent: string | undefined): PackageManager {
  const name = /^(pnpm|yarn|bun|npm)\//.exec(userAgent ?? "")?.[1];
  return (name as PackageManager | undefined) ?? "npm";
}

export const runScript = (pm: PackageManager, script: string) => (pm === "npm" ? `npm run ${script}` : `${pm} ${script}`);

export interface SuccessInput {
  name: string;
  stats: GenerateStats;
  installed: boolean;
  pm: PackageManager;
  notes: readonly string[];
}

export interface SuccessParts {
  headline: string;
  body: string[];
  closing: string;
}

export function successParts({ name, stats, installed, pm, notes }: SuccessInput): SuccessParts {
  const step = (cmd: string, why?: string) => (why ? `  ${pad(cmd, 26)}${dim(why)}` : `  ${cmd}`);
  return {
    headline: "AURIC foundation created",
    body: [
    `  ${name}/`,
    `  ${stats.modules} modules · ${stats.tables} tables · ${stats.rlsTables} with row-level security · ${stats.migrations} migrations`,
    "",
    pc.bold("Next"),
    step(`cd ${name}`),
    step(`createdb ${defaultDatabaseName(name)}`, "a NEW, EMPTY database — never reuse one"),
    step("cp .env.example .env", "already points at that database"),
    ...(installed ? [] : [step(`${pm} install`)]),
    step(runScript(pm, "migrate"), "create the tables"),
    step(runScript(pm, "dev"), "then open /api/health"),
    "",
    dim("Before real data: run provision-db, then point AURIC_APP_DATABASE_URL /"),
    dim("AURIC_SYSTEM_DATABASE_URL at those roles — until then row-level security is not enforced."),
    dim("The full walkthrough and troubleshooting are in README.md."),
    ...(notes.length ? ["", `${pc.yellow("▲")} ${notes.length === 1 ? "One note" : `${notes.length} notes`} about skipped modules: see "Good to know" in README.md`] : []),
    ],
    closing: `${pc.bold("Your Core is yours.")} ${dim("Build your domain on top of src/core.")}`,
  };
}

/** The success screen as plain lines (headline first, closing last). */
export function successLines(input: SuccessInput): string[] {
  const { headline, body, closing } = successParts(input);
  return [`${pc.green("✓")} ${pc.bold(headline)}`, ...body, "", closing];
}

export interface ErrorParts {
  /** What happened (no glyph — each renderer draws its own). */
  headline: string;
  body: string[];
}

export function errorParts(err: AuricError, verbose: boolean): ErrorParts {
  return {
    headline: err.what,
    body: [
      ...err.why.split("\n").map((l) => `  ${dim(l)}`),
      "",
      `${pc.bold("Next")}  ${err.hint}`,
      ...(verbose && err.cause instanceof Error && err.cause.stack ? ["", dim(err.cause.stack)] : []),
      // Developer mistakes are fully explained above; --verbose is only worth suggesting for the unexpected.
      ...(!verbose && !["USAGE", "INVALID_NAME", "DIR_EXISTS", "UNKNOWN_MODULE"].includes(err.code)
        ? ["", dim("Run with --verbose for the full error.")]
        : []),
    ],
  };
}

/** The error as plain lines (glyph included) — what the plain renderer prints. */
export function errorLines(err: AuricError, verbose: boolean): string[] {
  const { headline, body } = errorParts(err, verbose);
  return [`${pc.red("✖")} ${pc.bold(headline)}`, ...body];
}

export function helpText(version: string, manifests: readonly Manifest[]): string {
  const modules = selectableModules(manifests);
  const width = Math.max(...modules.map((m) => m.name.length)) + 2;
  return `${gold("AURIC")} ${dim(`create-auric ${version} · ${CREDIT}`)}
${TAGLINE}

${pc.bold("Usage")}
  npx create-auric [project-name] [options]

${pc.bold("Options")}
  -m, --modules <list>   comma-separated modules to include (skips the prompt)
  -y, --yes              accept defaults, ask nothing
      --install          install dependencies after generating
      --no-install       don't install dependencies
      --verbose          show generation details and full errors
  -h, --help             show this help
  -v, --version          show the version

${pc.bold("Modules")} ${dim("(the foundation — " + foundationModules(manifests).map((m) => m.title).join(", ") + " — is always included)")}
${modules.map((m) => `  ${pad(m.name, width)}${shortDescription(m.description)}`).join("\n")}

${pc.bold("Examples")}
  npx create-auric
  npx create-auric acme-platform
  npx create-auric acme-platform --modules files,messaging --yes
`;
}
