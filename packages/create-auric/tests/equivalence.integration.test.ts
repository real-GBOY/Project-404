import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canConnect,
  createDatabase,
  dropDatabase,
  migrateDeploy,
  provisionRoles,
  repoRoot,
  scaffold,
  snapshot,
  tableNames,
  type ScaffoldedProject,
} from "./support.js";

/**
 * The drift guard between the two ways of building Core's database:
 *
 *   A. the monorepo's own migration history (what Mizan / Atlas deploy), and
 *   B. a fresh scaffold-time baseline for the full Core module set.
 *
 * Ignoring product tables (`lawfirm_*`), they must produce a database that
 * enforces exactly the same rules — same columns, constraints, indexes,
 * triggers, RLS policies, functions, roles and grants. If someone adds a CHECK
 * constraint to a monorepo migration and forgets the module's `scaffold/*.sql`
 * fragment (or vice versa), this fails and names the difference.
 */
const available = await canConnect();
const DB_A = "auric_scaffold_equiv_history";
const DB_B = "auric_scaffold_equiv_generated";

describe.skipIf(!available)("scaffold baseline ≡ monorepo migration history (full Core)", () => {
  let project: ScaffoldedProject;
  let urlA: string;
  let urlB: string;

  beforeAll(async () => {
    urlA = await createDatabase(DB_A);
    await migrateDeploy(repoRoot, urlA);
    await provisionRoles(urlA);

    project = await scaffold("equiv", ["files", "notifications", "messaging", "assistant"]);
    urlB = await createDatabase(DB_B);
    await migrateDeploy(project.outDir, urlB);
    await provisionRoles(urlB);
  }, 240_000);

  afterAll(async () => {
    await project?.cleanup();
    await dropDatabase(DB_A);
    await dropDatabase(DB_B);
  });

  it("creates the same set of Core tables", async () => {
    const a = (await tableNames(urlA)).filter((t) => !t.startsWith("lawfirm_"));
    expect(await tableNames(urlB)).toEqual(a);
  });

  it("the scaffolded database has no product tables", async () => {
    expect((await tableNames(urlB)).filter((t) => /^(lawfirm_|realestate_|atlas_)/.test(t))).toEqual([]);
  });

  for (const facet of [
    "columns",
    "constraints",
    "indexes",
    "triggers",
    "policies",
    "rls",
    "functions",
    "grants",
    "extensions",
    "roles",
  ] as const) {
    it(`same ${facet}`, async () => {
      const [a, b] = await Promise.all([snapshot(urlA), snapshot(urlB)]);
      expect(b[facet]).toEqual(a[facet]);
    });
  }
});
