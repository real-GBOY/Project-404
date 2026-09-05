/** Ported from mizan/web/src/features/settings/api/settings.api.ts. */
export interface LawFirmSettings {
  firmName: string;
  registrationNumber: string;
  address: string;
  defaultCurrency: string;
  vatRate: number;
  matterTypes: string[];
  courts: string[];
  standardRates: { role: string; hourlyRate: number; currency: string }[];
  aiAssistantEnabled: boolean;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  resource: string;
  at: string;
  ip: string;
}
