import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadManifests } from "../src/manifest.js";
import { resolveSelection } from "../src/resolve.js";
import { assembleSchema, SchemaClosureError } from "../src/schema.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const manifests = loadManifests(join(repoRoot, "core"));
const prismaDir = join(repoRoot, "prisma", "schema");

const FOUNDATION = ["base", "identity", "organizations", "rbac"];
/** Install order: base first, then everything else A→Z. */
const order = (...extra: string[]) => ["base", ...[...FOUNDATION.slice(1), ...extra].sort()];

describe("resolveSelection", () => {
  it("always installs the required base, and the foundation it needs", () => {
    const r = resolveSelection(manifests, []);
    expect(r.selected).toEqual(FOUNDATION);
    expect(r.requested).toEqual([]);
  });

  it("selecting Identity alone pulls in Organizations and RBAC, with reasons", () => {
    const r = resolveSelection(manifests, ["identity"]);
    expect(r.selected).toEqual(FOUNDATION);
    expect(r.requested).toEqual(["identity"]);
    expect(r.added.map((a) => a.module)).toEqual(["organizations", "rbac"]);
    const orgs = r.added.find((a) => a.module === "organizations")!;
    expect(orgs.requiredBy).toContain("identity");
    expect(orgs.reasons.join(" ")).toMatch(/tenant/i);
  });

  it("Messaging requires Files (and the foundation)", () => {
    const r = resolveSelection(manifests, ["messaging"]);
    expect(r.selected).toEqual(order("files", "messaging"));
    expect(r.added.map((a) => a.module)).toContain("files");
    expect(r.added.find((a) => a.module === "files")!.requiredBy).toContain("messaging");
  });

  it("Assistant only needs the base foundation", () => {
    expect(resolveSelection(manifests, ["assistant"]).selected).toEqual(order("assistant"));
  });

  it("is order-independent and de-duplicates", () => {
    const a = resolveSelection(manifests, ["messaging", "files", "files"]);
    const b = resolveSelection(manifests, ["files", "messaging"]);
    expect(a.selected).toEqual(b.selected);
    expect(a.added.map((x) => x.module)).toEqual(b.added.map((x) => x.module));
  });

  it("does not report a module the developer chose as 'added'", () => {
    const r = resolveSelection(manifests, ["files", "messaging"]);
    expect(r.added.map((a) => a.module)).not.toContain("files");
  });

  it("rejects an unknown module", () => {
    expect(() => resolveSelection(manifests, ["billing"])).toThrow(/Unknown module "billing"/);
  });

  it("tolerates the genuine identity ⇄ organizations ⇄ rbac cycle", () => {
    expect(() => resolveSelection(manifests, ["identity", "organizations", "rbac"])).not.toThrow();
  });
});

describe("assembleSchema", () => {
  it("assembles a closed schema for every resolvable selection", () => {
    for (const pick of [[], ["files"], ["notifications"], ["messaging"], ["assistant"], ["files", "notifications", "messaging", "assistant"]]) {
      const r = resolveSelection(manifests, pick);
      const s = assembleSchema(prismaDir, manifests, r.selected);
      expect(s.files.length).toBeGreaterThan(0);
      // No product schema can ever leak in.
      expect(s.files.some((f) => f.name.startsWith("lawfirm-"))).toBe(false);
    }
  });

  it("contains exactly the selected modules' tables", () => {
    const r = resolveSelection(manifests, ["files"]);
    const tables = assembleSchema(prismaDir, manifests, r.selected).models.map((m) => m.table).sort();
    expect(tables).toEqual(
      manifests
        .filter((m) => r.selected.includes(m.name))
        .flatMap((m) => m.tables)
        .sort(),
    );
    expect(tables).not.toContain("messaging_messages");
    expect(tables).not.toContain("notifications");
  });

  it("refuses a selection that leaves a relation dangling, naming the modules", () => {
    // Bypass resolution on purpose: notifications without identity/organizations.
    expect(() => assembleSchema(prismaDir, manifests, ["base", "notifications"])).toThrow(SchemaClosureError);
    expect(() => assembleSchema(prismaDir, manifests, ["base", "notifications"])).toThrow(
      /"notifications" \(notifications\) has a foreign key to "users" from module "identity"/,
    );
  });

  it("drops back-relation fields whose module is not installed, keeps them when it is", () => {
    const without = assembleSchema(prismaDir, manifests, resolveSelection(manifests, []).selected);
    const usersWithout = without.files.find((f) => f.name === "identity.prisma")!.content;
    expect(usersWithout).not.toMatch(/notifications\s+notifications\[\]/);
    expect(usersWithout).toMatch(/user_roles\s+user_roles\[\]/); // rbac IS installed
    expect(without.droppedBackRelations.map((d) => `${d.model}.${d.field}`).sort()).toEqual([
      "organizations.notifications",
      "users.notifications",
    ]);

    const withNotif = assembleSchema(prismaDir, manifests, resolveSelection(manifests, ["notifications"]).selected);
    expect(withNotif.files.find((f) => f.name === "identity.prisma")!.content).toMatch(/notifications\s+notifications\[\]/);
    expect(withNotif.droppedBackRelations).toEqual([]);
  });
});
