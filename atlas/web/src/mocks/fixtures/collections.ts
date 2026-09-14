// Extracted verbatim from the design prototype's "Collections" table screen (TABLES().collections).

export interface CollectionFixture {
  project: string;
  due: string;
  collected: string;
  overdue: string;
  accounts: number;
  /** Collection rate percentage (0-100) */
  collectionRatePct: number;
}

export const COLLECTIONS: CollectionFixture[] = [
  { project: 'North Hills', due: 'EGP 168.4M', collected: 'EGP 158.9M', overdue: 'EGP 9.5M', accounts: 41, collectionRatePct: 94 },
  { project: 'Palm District', due: 'EGP 112.6M', collected: 'EGP 101.2M', overdue: 'EGP 11.4M', accounts: 33, collectionRatePct: 90 },
  { project: 'Cedar Residences', due: 'EGP 86.2M', collected: 'EGP 82.4M', overdue: 'EGP 3.8M', accounts: 18, collectionRatePct: 96 },
  { project: 'Skyline Business Park', due: 'EGP 64.8M', collected: 'EGP 51.1M', overdue: 'EGP 13.7M', accounts: 24, collectionRatePct: 79 },
  { project: 'West Avenue', due: 'EGP 20.1M', collected: 'EGP 19.2M', overdue: 'EGP 4.2M', accounts: 12, collectionRatePct: 86 },
];

// Screen KPIs (authored): Collected MTD EGP 412.8M (+11.2%), Due MTD EGP 452.1M, Collection rate 91.3%
// (+1.8pp), Overdue EGP 42.6M (+4.2%), Accounts in arrears 128 (+11). Note: summing COLLECTIONS.due
// (168.4+112.6+86.2+64.8+20.1 = 452.1M) reconciles exactly with the "Due MTD" KPI, and summing
// .collected (158.9+101.2+82.4+51.1+19.2 = 412.8M) reconciles exactly with "Collected MTD" — these two
// KPIs ARE derivable from COLLECTIONS (collectionRatePct = collected/due*100 per row, rounded).
