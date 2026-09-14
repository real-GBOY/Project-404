// Extracted verbatim from the design prototype's "Organization Settings" screen (`settings`, inside
// `moreVals()`, route 'orgsettings').

export interface OrgSettingFixture {
  label: string;
  value: string;
}

export interface OrgSettingsGroupFixture {
  label: string;
  rows: OrgSettingFixture[];
}

export const ORG_SETTINGS: OrgSettingsGroupFixture[] = [
  {
    label: 'Organisation',
    rows: [
      { label: 'Legal name', value: 'Atlas Developments S.A.E.' },
      { label: 'Commercial registry', value: '118 442 · Cairo' },
      { label: 'Tax ID', value: '204-882-119' },
      { label: 'Head office', value: 'Cairo Festival City, New Cairo' },
      { label: 'Reporting currency', value: 'EGP' },
      { label: 'Fiscal year', value: 'January – December' },
    ],
  },
  {
    label: 'Sales policy',
    rows: [
      { label: 'Default reservation hold', value: '14 days' },
      { label: 'Deposit', value: '3% of unit price' },
      { label: 'Down payment window', value: '14 days after reservation' },
      { label: 'Maximum discount', value: '6% with director approval' },
      { label: 'Auto-release expired reservations', value: 'Enabled' },
      { label: 'Lead SLA', value: 'First contact within 4 hours' },
    ],
  },
  {
    label: 'Finance',
    rows: [
      { label: 'Installment frequency', value: 'Quarterly' },
      { label: 'Late fee', value: '1.5% per month' },
      { label: 'Maintenance fee', value: '8% on delivery' },
      { label: 'Accepted methods', value: 'Bank transfer, cheque, Instapay, card' },
      { label: 'Collection escalation', value: '15 / 45 / 90 days' },
      { label: 'Commission clearing', value: 'On down payment receipt' },
    ],
  },
  {
    label: 'AI & automation',
    rows: [
      { label: 'Copilot data scope', value: 'Organisation-wide, role filtered' },
      { label: 'Insight refresh', value: 'Hourly' },
      { label: 'Autonomous actions', value: 'Disabled — approval required' },
      { label: 'Action audit', value: 'All actions logged' },
      { label: 'Model residency', value: 'EU region' },
      { label: 'Retention', value: '7 years' },
    ],
  },
];
