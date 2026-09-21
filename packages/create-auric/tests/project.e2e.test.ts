import { execFile, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadManifests } from "../src/manifest.js";
import { resolveSelection } from "../src/resolve.js";
import {
  APP_PASSWORD,
  SYSTEM_PASSWORD,
  canConnect,
  createDatabase,
  dropDatabase,
  migrateDeploy,
  provisionRoles,
  repoRoot,
  scaffold,
  urlFor,
  type ScaffoldedProject,
} from "./support.js";

/**
 * The full proof, per install set: the generated project is a real, working
 * application — its Kysely types match its tables, it type-checks, its own test
 * suite passes against ITS migrations, and it boots and answers HTTP.
 *
 * Slow (a tsc + a vitest run + a boot per set), so opt-in:
 *   AURIC_SCAFFOLD_E2E=1 npx vitest run packages/create-auric/tests/project.e2e
 *   AURIC_SCAFFOLD_E2E_ONLY=files   # only sets whose key contains "files"
 */
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

const REQUESTS: Record<string, string[]> = {
  "base only": [],
  "base + files": ["files"],
  "base + notifications": ["notifications"],
  "base + messaging": ["messaging"],
  "base + assistant": ["assistant"],
  "full core": ["files", "notifications", "messaging", "assistant"],
};

const manifests = loadManifests(join(repoRoot, "core"));
const byName = new Map(manifests.map((m) => [m.name, m]));
const only = process.env.AURIC_SCAFFOLD_E2E_ONLY;

const distinct = new Map<string, { selected: string[]; labels: string[]; modules: string[] }>();
for (const [label, modules] of Object.entries(REQUESTS)) {
  const { selected } = resolveSelection(manifests, modules);
  const key = selected.join("+");
  const entry = distinct.get(key) ?? { selected, labels: [], modules };
  entry.labels.push(label);
  distinct.set(key, entry);
}

const enabled = process.env.AURIC_SCAFFOLD_E2E === "1" && (await canConnect());

async function node(bin: string, args: string[], cwd: string, env: Record<string, string> = {}): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [require.resolve(bin), ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0", ...env },
      maxBuffer: 64 * 1024 * 1024,
    });
    return `${stdout}${stderr}`;
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    throw new Error(`${bin} ${args.join(" ")} failed:\n${[e.stdout, e.stderr].filter(Boolean).join("\n") || e.message}`);
  }
}

describe.skipIf(!enabled).each([...distinct.entries()].filter(([key]) => !only || key.includes(only)))(
  "generated project %s",
  (key, combo) => {
    const suffix = key.replace(/[^a-z]+/g, "_").slice(0, 36);
    const testDb = `auric_e2e_test_${suffix}`.slice(0, 60);
    const bootDb = `auric_e2e_boot_${suffix}`.slice(0, 60);
    let project: ScaffoldedProject;

    beforeAll(async () => {
      // The CLI writes the Kysely types itself — no install, no separate `prisma generate`.
      project = await scaffold("e2e", combo.modules, { types: true });
    }, 240_000);

    afterAll(async () => {
      await project?.cleanup();
      await dropDatabase(testDb);
      await dropDatabase(bootDb);
    });

    it("writes Kysely types for exactly the selected tables", () => {
      const types = readFileSync(join(project.outDir, "src/core/kernel/db/schema.ts"), "utf8");
      const declared = [...types.matchAll(/^export type (\w+) = \{/gm)].map((m) => m[1]!);
      const expected = combo.selected.flatMap((n) => byName.get(n)!.tables);
      // prisma-kysely names types after the Prisma model, which equals the table name in these schemas.
      for (const table of expected) expect(types, `table ${table}`).toContain(`  ${table}: ${table};`);
      expect(declared.length).toBeGreaterThanOrEqual(expected.length);
      for (const absent of ["messaging_messages", "notifications", "files", "ai_messages"]) {
        if (!expected.includes(absent)) expect(types, `${absent} must be absent`).not.toContain(`  ${absent}: ${absent};`);
      }
    });

    it("type-checks", async () => {
      await node("typescript/bin/tsc", ["--noEmit", "-p", "tsconfig.json"], project.outDir);
    }, 240_000);

    it("passes its own tests against its own migrations", async () => {
      const url = await createDatabase(testDb);
      const out = await node("vitest/vitest.mjs", ["run", "--reporter=dot"], project.outDir, {
        AURIC_TEST_DATABASE_URL: url,
        CI: "",
      });
      // A non-zero exit already threw. Also require a real run: log lines legitimately contain
      // the word "failed" (the structured-AI retry tests), so read the summary, not the stream.
      expect(out).toMatch(/Tests\s+\d+ passed/);
      expect(out).not.toMatch(/Tests[^\n]*\d+ failed/);
    }, 600_000);

    it("boots and answers /api/health", async () => {
      const owner = await createDatabase(bootDb);
      await migrateDeploy(project.outDir, owner);
      await provisionRoles(owner);
      const port = 4100 + Math.floor(Math.random() * 500);

      const child = spawn(
        process.execPath,
        ["--import", "@swc-node/register/esm-register", "src/main.ts"],
        {
          cwd: project.outDir,
          env: {
            ...process.env,
            NODE_ENV: "development",
            AURIC_PORT: String(port),
            AURIC_LOG_LEVEL: "warn",
            AURIC_DATABASE_URL: owner,
            AURIC_APP_DATABASE_URL: urlFor(bootDb, "auric_app", APP_PASSWORD),
            AURIC_SYSTEM_DATABASE_URL: urlFor(bootDb, "auric_system", SYSTEM_PASSWORD),
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let log = "";
      child.stdout.on("data", (d) => (log += d));
      child.stderr.on("data", (d) => (log += d));
      const exited = new Promise<number | null>((resolve) => child.on("exit", resolve));

      try {
        let status = 0;
        const deadline = Date.now() + 90_000;
        while (Date.now() < deadline) {
          if (child.exitCode !== null) throw new Error(`app exited early (${child.exitCode}):\n${log}`);
          try {
            status = (await fetch(`http://127.0.0.1:${port}/api/health`)).status;
            if (status === 200) break;
          } catch {
            /* not listening yet */
          }
          await new Promise((r) => setTimeout(r, 500));
        }
        expect(status, `health never returned 200:\n${log}`).toBe(200);
      } finally {
        child.kill();
        await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
      }
    }, 180_000);
  },
);
