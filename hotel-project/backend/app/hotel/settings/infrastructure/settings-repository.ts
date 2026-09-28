import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";

export interface HotelSettings {
  hotelName: string;
  timeZone: string;
  currency: "EGP";
  checkInTime: string;
  checkOutTime: string;
  taxRate: number;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export type SettingsPatch = Partial<
  Pick<
    HotelSettings,
    "hotelName" | "checkInTime" | "checkOutTime" | "taxRate" | "address" | "phone" | "email"
  >
>;

@Injectable()
export class SettingsRepository {
  async find(): Promise<HotelSettings | null> {
    const row = await hotelDb()
      .selectFrom("hotel_settings")
      .selectAll()
      .where("organization_id", "=", requireOrganizationId())
      .executeTakeFirst();
    if (!row) return null;
    return {
      hotelName: row.hotel_name,
      timeZone: row.time_zone,
      currency: row.currency,
      checkInTime: row.check_in_time,
      checkOutTime: row.check_out_time,
      taxRate: Number(row.tax_rate),
      address: row.address,
      phone: row.phone,
      email: row.email,
    };
  }

  async organizationName(): Promise<string> {
    const row = await hotelDb()
      .selectFrom("organizations")
      .select("name")
      .where("id", "=", requireOrganizationId())
      .executeTakeFirstOrThrow();
    return row.name;
  }

  /** Insert-or-update the tenant's single settings row. */
  async upsert(values: HotelSettings): Promise<void> {
    const row = {
      organization_id: requireOrganizationId(),
      hotel_name: values.hotelName,
      time_zone: values.timeZone,
      currency: values.currency,
      check_in_time: values.checkInTime,
      check_out_time: values.checkOutTime,
      tax_rate: values.taxRate.toFixed(4),
      address: values.address,
      phone: values.phone,
      email: values.email,
    };
    await hotelDb()
      .insertInto("hotel_settings")
      .values(row)
      .onConflict((oc) =>
        oc.column("organization_id").doUpdateSet({
          hotel_name: row.hotel_name,
          check_in_time: row.check_in_time,
          check_out_time: row.check_out_time,
          tax_rate: row.tax_rate,
          address: row.address,
          phone: row.phone,
          email: row.email,
        }),
      )
      .execute();
  }
}
