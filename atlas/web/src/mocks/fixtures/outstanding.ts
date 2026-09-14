// Extracted verbatim from the design prototype's "Outstanding Payments" table screen (TABLES().outstanding).

export interface OutstandingAccountFixture {
  customer: string;
  customerId: string;
  unit: string;
  overdue: string;
  aging: 'High' | 'Medium' | 'Low';
  agingDays: number;
  lastContact: string;
  agent: string;
  /** Exposure percentage (0-100) used for the bar visualization */
  exposurePct: number;
}

export const OUTSTANDING: OutstandingAccountFixture[] = [
  { customer: 'Ziad Hafez', customerId: 'CU-0008', unit: 'WA-118', overdue: 'EGP 465,000', aging: 'High', agingDays: 112, lastContact: '14 Feb 2026', agent: 'Kariman Osman', exposurePct: 92 },
  { customer: 'Amr Selim', customerId: 'CU-0114', unit: 'OFF-1102', overdue: 'EGP 2,240,000', aging: 'High', agingDays: 96, lastContact: '21 Feb 2026', agent: 'Youssef Hegazy', exposurePct: 88 },
  { customer: 'Dina Nabil', customerId: 'CU-0005', unit: 'C-0208', overdue: 'EGP 107,000', aging: 'Medium', agingDays: 64, lastContact: '02 Mar 2026', agent: 'Menna Kamal', exposurePct: 54 },
  { customer: 'Hany Roushdy', customerId: 'CU-0207', unit: 'D-0912', overdue: 'EGP 780,000', aging: 'Medium', agingDays: 58, lastContact: '28 Feb 2026', agent: 'Sara Fathy', exposurePct: 61 },
  { customer: 'Rania Ezzat', customerId: 'CU-0311', unit: 'B-0604', overdue: 'EGP 290,000', aging: 'Medium', agingDays: 41, lastContact: '05 Mar 2026', agent: 'Ahmed Mohamed', exposurePct: 44 },
  { customer: 'Waleed Sabry', customerId: 'CU-0402', unit: 'A-0208', overdue: 'EGP 186,000', aging: 'Low', agingDays: 22, lastContact: '09 Mar 2026', agent: 'Mohamed Adel', exposurePct: 28 },
];

// Screen KPIs (authored): Total overdue EGP 42.6M (+4.2%), 90+ days EGP 14.2M (+2.1M), Accounts 128
// (+11), Recovered 30d EGP 11.8M (+18%). Subtitle: "Overdue balances prioritised by aging and exposure".
