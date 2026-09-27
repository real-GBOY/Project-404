import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import {
  SettingsRepository,
  type HotelSettings,
  type SettingsPatch,
} from "../infrastructure/settings-repository.js";

/** Egypt defaults for a hotel that has not saved settings yet. */
export const DEFAULT_SETTINGS: Omit<HotelSettings, "hotelName"> = {
  timeZone: "Africa/Cairo",
  currency: "EGP",
  checkInTime: "14:00",
  checkOutTime: "12:00",
  taxRate: 0.14,
  address: null,
  phone: null,
  email: null,
};

/**
 * The property's operating settings (one row per organization in v1). Reads fall back to Egypt
 * defaults named after the organization, so every other module can rely on `current()` returning
 * a complete value; the row is created on first save.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly repo: SettingsRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  get(): Promise<HotelSettings> {
    return readInTenant(() => this.current());
  }

  /** Inside an existing tenant transaction. */
  async current(): Promise<HotelSettings> {
    return (
      (await this.repo.find()) ?? {
        ...DEFAULT_SETTINGS,
        hotelName: await this.repo.organizationName(),
      }
    );
  }

  update(patch: SettingsPatch, actorId: string): Promise<HotelSettings> {
    return this.uow.transaction(async () => {
      const before = await this.current();
      const after: HotelSettings = { ...before, ...patch };
      await this.repo.upsert(after);
      await this.audit.record({
        actorId,
        action: "hotel.settings.updated",
        resourceType: "hotel_settings",
        resourceId: null,
        before,
        after,
      });
      return after;
    });
  }
}
