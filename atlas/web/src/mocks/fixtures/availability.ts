// Extracted verbatim from the design prototype's "Availability" table screen (TABLES().availability).

export interface AvailabilityRowFixture {
  project: string;
  unitType: string;
  available: number;
  reserved: number;
  sold: number;
  priceFromEgp: string;
  /** absorption percentage (0-100) */
  absorptionPct: number;
  agingDays: number;
}

export const AVAILABILITY: AvailabilityRowFixture[] = [
  { project: 'North Hills', unitType: '1-Bedroom', available: 18, reserved: 4, sold: 52, priceFromEgp: 'EGP 2.9M', absorptionPct: 74, agingDays: 41 },
  { project: 'North Hills', unitType: '2-Bedroom', available: 44, reserved: 11, sold: 118, priceFromEgp: 'EGP 4.2M', absorptionPct: 72, agingDays: 58 },
  { project: 'North Hills', unitType: '3-Bedroom', available: 38, reserved: 9, sold: 84, priceFromEgp: 'EGP 6.4M', absorptionPct: 68, agingDays: 77 },
  { project: 'North Hills', unitType: 'Penthouse', available: 13, reserved: 7, sold: 14, priceFromEgp: 'EGP 12.8M', absorptionPct: 42, agingDays: 132 },
  { project: 'Palm District', unitType: '2-Bedroom', available: 52, reserved: 14, sold: 96, priceFromEgp: 'EGP 3.6M', absorptionPct: 64, agingDays: 69 },
  { project: 'Cedar Residences', unitType: 'Villa', available: 9, reserved: 3, sold: 48, priceFromEgp: 'EGP 18.4M', absorptionPct: 80, agingDays: 88 },
  { project: 'Skyline Business Park', unitType: 'Office', available: 78, reserved: 16, sold: 61, priceFromEgp: 'EGP 9.2M', absorptionPct: 44, agingDays: 124 },
  { project: 'West Avenue', unitType: '2-Bedroom', available: 61, reserved: 15, sold: 11, priceFromEgp: 'EGP 2.8M', absorptionPct: 15, agingDays: 22 },
];

// Screen KPIs (authored, not recomputed from AVAILABILITY rows above): Available 443 (-58), Reserved 110
// (+12), Sold 733 (+58), On hold 18 (+3), Avg. days on market 64 (-9).
