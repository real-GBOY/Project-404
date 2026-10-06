import { Injectable } from "@nestjs/common";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { getContext } from "@core/kernel/logging/context.js";
import { mergeSettings, type OrgSettings } from "../domain/defaults.js";

@Injectable()
export class SettingsRepository {
  /** Saved settings merged over defaults. RLS scopes the row to the active organization. */
  async load(): Promise<OrgSettings> {
    const row = await raqibDb().selectFrom("raqib_settings").select("data").executeTakeFirst();
    return mergeSettings((row?.data as Record<string, unknown> | undefined) ?? null);
  }

  async save(settings: OrgSettings, actorId: string | null): Promise<void> {
    const orgId = getContext()?.organizationId;
    if (!orgId) throw new Error("settings save outside a tenant context");
    await raqibDb()
      .insertInto("raqib_settings")
      .values({ organization_id: orgId, data: settings as never, updated_by: actorId })
      .onConflict((oc) => oc.column("organization_id").doUpdateSet({ data: settings as never, updated_by: actorId }))
      .execute();
  }
}
