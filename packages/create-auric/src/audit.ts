import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The public-package safety net. Scans a directory tree that is about to be
 * published (the Core snapshot, templates, compiled CLI) for anything that must
 * never leave the building: product code, demo data, secrets, machine paths.
 * Run by the package build (which then refuses to pack) and by the tests.
 */
export interface Finding {
  file: string;
  rule: string;
  detail: string;
}

/** Product and demo vocabulary. Word-bounded where a plain substring would false-positive. */
const PRODUCT_WORDS = /mizan|lawfirm|law[-_ ]firm|real[-_ ]?estate|\batlas\b|\bdemos?\b/i;

/**
 * Documentation may use a generic business domain as its worked example (a real-estate SaaS),
 * but still never names the products this Core came from, nor demo material.
 */
const DOC_PRODUCT_WORDS = /mizan|lawfirm|law[-_ ]firm|\batlas\b|\bdemos?\b/i;

const FORBIDDEN_NAMES: Array<[RegExp, string]> = [
  [PRODUCT_WORDS, "product/demo name in a file path"],
  [/(^|\/)\.env(\.(?!example$)|$)/, "environment file (only .env.example is allowed)"],
  [/\.(pem|key|p12|pfx|sqlite3?|db|log|tmp|bak|orig|swp)$/i, "secret, database or temp file"],
  [/(^|\/)(id_rsa|id_ed25519)/, "private key"],
  [/(^|\/)(node_modules|\.git|\.vercel|coverage|storage)\//, "must not be published"],
];

const CONTENT_RULES: Array<[RegExp, string]> = [
  [PRODUCT_WORDS, "product/demo name"],
  [/gsk_[A-Za-z0-9]{16,}/, "Groq API key"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "API key"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\bxox[abp]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\./, "JWT"],
  [/[A-Za-z]:[\\/]+(Users|Clients|Projects?)[\\/]/i, "absolute Windows path"],
  [/(^|[^\w.])\/(home|Users)\/[a-z][\w.-]*\//, "absolute home path"],
  [/sslip\.io|\.internal\b/, "deployment hostname"],
  [/mahmm/i, "machine username"],
];

const TEXT_EXT =
  /\.(ts|tsx|js|mjs|cjs|json|md|sql|prisma|toml|yml|yaml|txt|sh|map)$|(^|\/)(gitignore|swcrc|LICENSE)$/i;

/** Well-known documentation placeholders that look like secrets but are not. */
const ALLOWED_SNIPPETS = ["AKIAIOSFODNN7EXAMPLE", "wJalrXUtnFEMI"];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

export function scanForForbidden(
  root: string,
  opts: {
    skipContent?: RegExp;
    docs?: RegExp;
    /**
     * Strings that are the developer's own, never a leak — chiefly the project name, which lands in
     * package.json, README.md and main.ts. A project called `demo-app` or `atlas-crm` is legitimate.
     */
    allow?: readonly string[];
  } = {},
): Finding[] {
  const findings: Finding[] = [];
  for (const full of walk(root)) {
    const rel = relative(root, full).split("\\").join("/");

    const isDoc = opts.docs?.test(rel) ?? false;
    for (const [pattern, rule] of FORBIDDEN_NAMES) {
      const re = isDoc && pattern === PRODUCT_WORDS ? DOC_PRODUCT_WORDS : pattern;
      if (re.test(rel)) findings.push({ file: rel, rule, detail: rel });
    }
    if (!TEXT_EXT.test(rel) || opts.skipContent?.test(rel)) continue;

    // The developer's own strings are blanked (not removed), so line numbers still point at the real line.
    const text = (opts.allow ?? []).reduce(
      (t, a) => (a ? t.split(a).join(" ".repeat(a.length)) : t),
      readFileSync(full, "utf8"),
    );
    for (const [pattern, rule] of CONTENT_RULES) {
      const re = isDoc && pattern === PRODUCT_WORDS ? DOC_PRODUCT_WORDS : pattern;
      const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
      for (const m of text.matchAll(new RegExp(re.source, flags))) {
        if (ALLOWED_SNIPPETS.some((a) => m[0].includes(a))) continue;
        const line = text.slice(0, m.index).split("\n").length;
        findings.push({ file: `${rel}:${line}`, rule, detail: m[0].slice(0, 60) });
      }
    }
  }
  return findings;
}

export function formatFindings(findings: readonly Finding[]): string {
  return findings.map((f) => `  ${f.file}  [${f.rule}]  ${f.detail}`).join("\n");
}
