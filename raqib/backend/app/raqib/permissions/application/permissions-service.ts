import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { getContext } from "@core/kernel/logging/context.js";
import { ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { requireCan, type Access } from "@raqib/raqib/access/access.js";
import { AccessService } from "@raqib/raqib/access/application/access-service.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import { ACTIONS, APPLICABLE, DEFAULT_TEMPLATES, MODULES, ROLE_KEYS, type ModuleKey, type RoleKey } from "@raqib/raqib/shared/modules.js";

export interface TemplateChange {
  role: RoleKey;
  module: ModuleKey;
  actions: string;
}

@Injectable()
export class PermissionsService {
  constructor(
    private readonly access: AccessService,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /** Effective templates plus the catalogue the editor needs (modules, letters, applicability, defaults). */
  async overview(who: Access) {
    requireCan(who, "permissions", "V");
    return {
      roles: await this.access.allTemplates(),
      defaults: DEFAULT_TEMPLATES,
      modules: MODULES,
      actions: ACTIONS,
      applicable: APPLICABLE,
    };
  }

  /**
   * Apply a batch of template edits. Every changed (role, module) is audited with before/after and the
   * stated reason. Guard rails: letters must be applicable to the module; Quality Management can never
   * lose the ability to edit permissions (no lock-out); the confidential area is not a module here.
   */
  async apply(changes: TemplateChange[], reason: string, who: Access): Promise<ReturnType<PermissionsService["overview"]>> {
    requireCan(who, "permissions", "E");
    for (const c of changes) {
      const allowed = APPLICABLE[c.module];
      const bad = [...c.actions].filter((l) => !allowed.includes(l));
      if (bad.length) throw ValidationError("raqib.inapplicable_action", `Action ${bad.join(",")} does not apply to ${c.module}.`);
      if (c.role === "qm" && c.module === "permissions" && !c.actions.includes("E")) {
        throw ValidationError("raqib.permissions_lockout", "Quality Management must keep the right to edit permissions.");
      }
    }
    await this.uow.transaction(async () => {
      const current = await this.access.allTemplates();
      const orgId = getContext()!.organizationId!;
      for (const c of changes) {
        const letters = ACTIONS.filter((l) => c.actions.includes(l)).join("");
        const before = current[c.role][c.module];
        if (before === letters) continue;
        await raqibDb()
          .insertInto("raqib_role_templates")
          .values({ id: raqibId("rtp"), organization_id: orgId, role_key: c.role, module: c.module, actions: letters, updated_by: who.userId })
          .onConflict((oc) => oc.columns(["organization_id", "role_key", "module"]).doUpdateSet({ actions: letters, updated_by: who.userId }))
          .execute();
        await this.audit.record({
          actorId: who.userId,
          action: "raqib.permission.changed",
          resourceType: "raqib_role_template",
          resourceId: `${c.role}:${c.module}`,
          before: { actions: before },
          after: { actions: letters },
          metadata: { role: c.role, module: c.module, reason },
        });
      }
    });
    return this.overview(who);
  }
}

export { ROLE_KEYS };
