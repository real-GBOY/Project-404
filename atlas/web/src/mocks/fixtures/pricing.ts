// Extracted verbatim from the design prototype's "Pricing" table screen (TABLES().pricing).

export interface PriceListFixture {
  name: string;
  project: string;
  version: string;
  basePerSqmEgp: string;
  floorPremium: string;
  maxDiscount: string;
  effectiveDate: string;
  status: 'Active' | 'Awaiting Approval' | 'Draft';
}

export const PRICE_LISTS: PriceListFixture[] = [
  { name: 'NH Residential Q1-26', project: 'North Hills', version: 'v4.2', basePerSqmEgp: 'EGP 58,200', floorPremium: '+1.4% / floor', maxDiscount: '5.0%', effectiveDate: '01 Jan 2026', status: 'Active' },
  { name: 'NH Penthouse Q1-26', project: 'North Hills', version: 'v2.0', basePerSqmEgp: 'EGP 74,500', floorPremium: '+2.1% / floor', maxDiscount: '3.0%', effectiveDate: '01 Jan 2026', status: 'Active' },
  { name: 'PD Residential Q1-26', project: 'Palm District', version: 'v3.1', basePerSqmEgp: 'EGP 46,800', floorPremium: '+1.2% / floor', maxDiscount: '6.0%', effectiveDate: '15 Jan 2026', status: 'Active' },
  { name: 'Cedar Villas 2026', project: 'Cedar Residences', version: 'v5.0', basePerSqmEgp: 'EGP 68,400', floorPremium: '—', maxDiscount: '4.0%', effectiveDate: '01 Feb 2026', status: 'Active' },
  { name: 'Skyline Office Q2-26', project: 'Skyline Business Park', version: 'v1.6', basePerSqmEgp: 'EGP 61,200', floorPremium: '+1.8% / floor', maxDiscount: '6.0%', effectiveDate: '01 Apr 2026', status: 'Awaiting Approval' },
  { name: 'WA Launch Pricing', project: 'West Avenue', version: 'v1.0', basePerSqmEgp: 'EGP 38,900', floorPremium: '+1.0% / floor', maxDiscount: '8.0%', effectiveDate: '01 May 2026', status: 'Draft' },
];

// Screen KPIs (authored): Active lists 7, Avg. price / m² EGP 52,400 (+3.8%), Max discount 6.0%, Pending
// approval 2. Note PRICE_LISTS above has only 6 rows while the KPI says 7 active lists — a gap in the
// source prototype (one active list is referenced by the KPI count but not represented as a row).
