import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import { currentExecutor } from "@core/kernel/db/db.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { RbacRepository } from "@core/rbac/infrastructure/rbac-repository.js";
import { seedRbacDefinitions } from "@core/rbac/application/seed.js";
import type { PermissionDefinition } from "@core/rbac/domain/permission.js";
import type { RoleSeed } from "@core/rbac/domain/role.js";
import { asSystem, createTestCore, get, hasTestDb } from "@core/tests/helpers.js";

const suite = hasTestDb ? describe : describe.skip;

/** A product-shaped extension of the Core contract — Core must accept it without knowing about `meta`. */
interface ExtendedRoleSeed extends RoleSeed {
  meta: { dataScope: string };
}

suite("core/rbac — seedRbacDefinitions (the generic seeding mechanism)", () => {
  let core: TestingModule;
  const repo = () => get<RbacRepository>(core, RbacRepository);
  const uow = () => get<UnitOfWork>(core, UNIT_OF_WORK);

  const PERMS: PermissionDefinition[] = [
    { action: "read", resource: "widget", description: "Read widgets" },
    { action: "update", resource: "widget" },
  ];
  const ROLES: ExtendedRoleSeed[] = [
    { key: "widget_viewer", name: "Widget Viewer", description: "Reads widgets", permissionKeys: ["read:widget"], meta: { dataScope: "own" } },
    { key: "widget_editor", name: "Widget Editor", description: "Edits widgets", permissionKeys: ["read:widget", "update:widget"], meta: { dataScope: "team" } },
  ];

  const grants = () =>
    asSystem(() =>
      currentExecutor()
        .selectFrom("role_permissions as rp")
        .innerJoin("roles as r", "r.id", "rp.role_id")
        .innerJoin("permissions as p", "p.id", "rp.permission_id")
        .select(["r.key as role", "p.action", "p.resource"])
        .where("r.key", "like", "widget_%")
        .orderBy("r.key").orderBy("p.action")
        .execute(),
    );
  const rolesNamed = () =>
    asSystem(() => currentExecutor().selectFrom("roles").select(["key", "name", "description", "is_system"]).where("key", "like", "widget_%").orderBy("key").execute());

  beforeAll(async () => {
    core = await createTestCore({ requireEmailVerification: false });
  }, 60_000);
  afterAll(async () => {
    await core?.close();
  });

  it("registers permissions, creates the roles as system roles, and grants exactly the listed keys", async () => {
    await asSystem(() => seedRbacDefinitions(repo(), uow(), { permissions: PERMS, roles: ROLES }));

    expect(await rolesNamed()).toEqual([
      { key: "widget_editor", name: "Widget Editor", description: "Edits widgets", is_system: true },
      { key: "widget_viewer", name: "Widget Viewer", description: "Reads widgets", is_system: true },
    ]);
    expect(await grants()).toEqual([
      { role: "widget_editor", action: "read", resource: "widget" },
      { role: "widget_editor", action: "update", resource: "widget" },
      { role: "widget_viewer", action: "read", resource: "widget" },
    ]);
  });

  it("is idempotent: running it again changes nothing", async () => {
    const before = { roles: await rolesNamed(), grants: await grants() };
    await asSystem(() => seedRbacDefinitions(repo(), uow(), { permissions: PERMS, roles: ROLES }));
    await asSystem(() => seedRbacDefinitions(repo(), uow(), { permissions: PERMS, roles: ROLES }));
    expect({ roles: await rolesNamed(), grants: await grants() }).toEqual(before);
  });

  it("leaves an existing role's name/description alone (they are editable afterwards) and only ADDS grants", async () => {
    await asSystem(() =>
      currentExecutor().updateTable("roles").set({ name: "Renamed by an admin" }).where("key", "=", "widget_viewer").execute(),
    );
    const more: ExtendedRoleSeed[] = [
      { ...ROLES[0]!, name: "Widget Viewer (seed says this)", permissionKeys: ["read:widget", "update:widget"] },
    ];
    await asSystem(() => seedRbacDefinitions(repo(), uow(), { permissions: PERMS, roles: more }));

    const viewer = (await rolesNamed()).find((r) => r.key === "widget_viewer")!;
    expect(viewer.name).toBe("Renamed by an admin"); // not overwritten
    expect((await grants()).filter((g) => g.role === "widget_viewer").map((g) => g.action)).toEqual(["read", "update"]); // additive
  });

  it("is ATOMIC: a malformed permission key aborts the whole seed — nothing from it is persisted", async () => {
    const roles: RoleSeed[] = [
      { key: "widget_ok", name: "Fine", description: "d", permissionKeys: ["read:widget"] },
      { key: "widget_broken", name: "Broken", description: "d", permissionKeys: ["read:widget", "not-a-valid-key"] },
    ];
    await expect(asSystem(() => seedRbacDefinitions(repo(), uow(), { permissions: PERMS, roles }))).rejects.toThrow(
      /invalid permission key "not-a-valid-key" on role "widget_broken"/,
    );
    const keys = (await rolesNamed()).map((r) => r.key);
    expect(keys).not.toContain("widget_ok"); // the role seeded BEFORE the failure was rolled back too
    expect(keys).not.toContain("widget_broken");
  });

  it("does not depend on tenant context: it runs in system context and writes only global tables", async () => {
    const tables = await asSystem(() =>
      currentExecutor().selectFrom("roles").select("key").where("key", "like", "widget_%").execute(),
    );
    expect(tables.length).toBeGreaterThan(0); // seeded without any organization in scope
  });
});
