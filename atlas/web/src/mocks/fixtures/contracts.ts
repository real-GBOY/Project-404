// Extracted verbatim from the design prototype's "Contracts" table screen (TABLES().contracts).

export interface ContractFixture {
  id: string;
  customer: string;
  unit: string;
  value: string;
  /** Signed date, or "—" if not yet signed */
  signed: string;
  /** Number of documents attached */
  docs: number;
  status: 'Signed' | 'Awaiting Approval' | 'Draft';
}

export const CONTRACTS: ContractFixture[] = [
  { id: 'C-0193', customer: 'Mona Fahmy', unit: 'A-0712 · North Hills', value: 'EGP 5.60M', signed: '02 Mar 2026', docs: 7, status: 'Signed' },
  { id: 'C-0192', customer: 'Sherif Zaki', unit: 'D-0705 · Palm District', value: 'EGP 7.80M', signed: '28 Feb 2026', docs: 6, status: 'Signed' },
  { id: 'C-0191', customer: 'Hala Mostafa', unit: 'C-0104 · Cedar Residences', value: 'EGP 6.10M', signed: '—', docs: 4, status: 'Awaiting Approval' },
  { id: 'C-0190', customer: 'Omar Shaker', unit: 'OFF-0904 · Skyline', value: 'EGP 11.20M', signed: '24 Feb 2026', docs: 9, status: 'Signed' },
  { id: 'C-0189', customer: 'Karim Abdelrahman', unit: 'A-0508 · North Hills', value: 'EGP 5.80M', signed: '21 Feb 2026', docs: 7, status: 'Signed' },
  { id: 'C-0188', customer: 'Dina Nabil', unit: 'C-0208 · Cedar Residences', value: 'EGP 6.90M', signed: '—', docs: 3, status: 'Draft' },
  { id: 'C-0187', customer: 'Ziad Hafez', unit: 'WA-118 · West Avenue', value: 'EGP 3.10M', signed: '18 Feb 2026', docs: 5, status: 'Signed' },
];

// Screen KPIs (authored): Contracts 312 (+9), Awaiting approval 6, Contracted value EGP 8.94B (+7.2%),
// Avg. time to sign 11 days (-2). Subtitle: "312 contracts · 6 awaiting approval · EGP 8.94B contracted
// value" — CONTRACTS above is a 7-row sample of that larger dataset.
