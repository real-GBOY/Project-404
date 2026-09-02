import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { decimal } from "@app/lawfirm/shared/money.js";

export interface StandardRate {
  role: string;
  hourlyRate: number;
  currency: string;
}

export interface LawFirmSettings {
  firmName: string;
  registrationNumber: string;
  address: string;
  defaultCurrency: string;
  vatRate: number;
  matterTypes: string[];
  courts: string[];
  standardRates: StandardRate[];
  aiAssistantEnabled: boolean;
}

const PRACTICE_AREA_DEFAULTS = [
  "Litigation",
  "Corporate",
  "Real Estate",
  "Employment",
  "Arbitration",
  "Tax",
];
const COURT_DEFAULTS = [
  "Cairo Economic Court",
  "Cairo Court of Appeal",
  "South Cairo Primary Court",
  "Giza Primary Court",
  "Alexandria Economic Court",
];

@Injectable()
export class SettingsRepository {
  async find(): Promise<LawFirmSettings | null> {
    const row = await currentExecutor()
      .selectFrom("lawfirm_settings")
      .selectAll()
      .where("organization_id", "=", requireOrganizationId())
      .executeTakeFirst();
    return row ? this.toSettings(row) : null;
  }

  async create(input: { firmName: string }): Promise<LawFirmSettings> {
    const values: LawFirmSettings = {
      firmName: input.firmName,
      registrationNumber: "",
      address: "",
      defaultCurrency: "EGP",
      vatRate: 0.14,
      matterTypes: PRACTICE_AREA_DEFAULTS,
      courts: COURT_DEFAULTS,
      standardRates: [],
      aiAssistantEnabled: true,
    };
    await currentExecutor()
      .insertInto("lawfirm_settings")
      .values({
        organization_id: requireOrganizationId(),
        firm_name: values.firmName,
        registration_number: values.registrationNumber,
        address: values.address,
        default_currency: values.defaultCurrency as "EGP" | "AED" | "USD" | "SAR",
        vat_rate: String(values.vatRate),
        matter_types: values.matterTypes,
        courts: values.courts,
        standard_rates: sql`${JSON.stringify(values.standardRates)}::jsonb`,
        ai_assistant_enabled: values.aiAssistantEnabled,
      })
      .onConflict((oc) => oc.column("organization_id").doNothing())
      .execute();
    return (await this.find()) ?? values;
  }

  async update(patch: Partial<LawFirmSettings>): Promise<LawFirmSettings> {
    const set: Record<string, unknown> = {};
    if (patch.firmName !== undefined) set.firm_name = patch.firmName;
    if (patch.registrationNumber !== undefined) set.registration_number = patch.registrationNumber;
    if (patch.address !== undefined) set.address = patch.address;
    if (patch.defaultCurrency !== undefined) set.default_currency = patch.defaultCurrency;
    if (patch.vatRate !== undefined) set.vat_rate = String(patch.vatRate);
    if (patch.matterTypes !== undefined) set.matter_types = patch.matterTypes;
    if (patch.courts !== undefined) set.courts = patch.courts;
    if (patch.standardRates !== undefined) set.standard_rates = sql`${JSON.stringify(patch.standardRates)}::jsonb`;
    if (patch.aiAssistantEnabled !== undefined) set.ai_assistant_enabled = patch.aiAssistantEnabled;

    if (Object.keys(set).length > 0) {
      await currentExecutor()
        .updateTable("lawfirm_settings")
        .set(set)
        .where("organization_id", "=", requireOrganizationId())
        .execute();
    }
    return (await this.find())!;
  }

  private toSettings(row: {
    firm_name: string;
    registration_number: string;
    address: string;
    default_currency: string;
    vat_rate: string;
    matter_types: string[];
    courts: string[];
    standard_rates: unknown;
    ai_assistant_enabled: boolean;
  }): LawFirmSettings {
    return {
      firmName: row.firm_name,
      registrationNumber: row.registration_number,
      address: row.address,
      defaultCurrency: row.default_currency,
      vatRate: decimal(row.vat_rate),
      matterTypes: row.matter_types ?? [],
      courts: row.courts ?? [],
      standardRates: (row.standard_rates as StandardRate[] | null) ?? [],
      aiAssistantEnabled: row.ai_assistant_enabled,
    };
  }
}
