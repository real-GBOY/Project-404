// Extracted verbatim from the design prototype's `BUILDINGS` class field (floor-plan config keyed by
// project id) and the "Buildings" table screen rows (explicit per-building stats).
// NOTE: the two sources are NOT perfectly reconciled in the prototype — see the mismatch note at the
// bottom of this file.

export interface BuildingLayoutFixture {
  /** Short building key used to build unit ids, e.g. 'A', 'C1', 'TN' */
  key: string;
  name: string;
  floors: number;
  unitsPerFloor: number;
}

// BUILDINGS: project id -> ordered list of building layouts (floors x unitsPerFloor drive procedural unit generation, see units.ts)
export const BUILDING_LAYOUTS: Record<string, BuildingLayoutFixture[]> = {
  'north-hills': [
    { key: 'A', name: 'Building A', floors: 12, unitsPerFloor: 8 },
    { key: 'B', name: 'Building B', floors: 12, unitsPerFloor: 8 },
    { key: 'C', name: 'Building C', floors: 14, unitsPerFloor: 8 },
  ],
  'palm-district': [
    { key: 'D', name: 'Building D', floors: 10, unitsPerFloor: 8 },
    { key: 'E', name: 'Building E', floors: 10, unitsPerFloor: 8 },
  ],
  'cedar-res': [
    { key: 'C1', name: 'Cedar 1', floors: 8, unitsPerFloor: 6 },
    { key: 'C2', name: 'Cedar 2', floors: 8, unitsPerFloor: 6 },
  ],
  skyline: [{ key: 'TN', name: 'Tower North', floors: 14, unitsPerFloor: 6 }],
  'west-ave': [{ key: 'WA', name: 'WA Block 1', floors: 6, unitsPerFloor: 8 }],
};

// The "Buildings" table screen (TABLES().buildings) — authored per-building stats, independent rows.
export interface BuildingTableRowFixture {
  building: string;
  project: string;
  floors: number;
  units: number;
  sold: number;
  /** conversion percentage (0-100), authored directly (not recomputed from sold/units in this table) */
  conversionPct: number;
  handover: string;
  status: 'Under Construction' | 'Launched' | 'Delivered' | 'Pre-launch';
}

export const BUILDINGS_TABLE: BuildingTableRowFixture[] = [
  { building: 'Building A', project: 'North Hills', floors: 12, units: 104, sold: 78, conversionPct: 74, handover: 'Q4 2026', status: 'Under Construction' },
  { building: 'Building B', project: 'North Hills', floors: 12, units: 108, sold: 71, conversionPct: 66, handover: 'Q4 2026', status: 'Under Construction' },
  { building: 'Building C', project: 'North Hills', floors: 14, units: 120, sold: 98, conversionPct: 82, handover: 'Q2 2026', status: 'Launched' },
  { building: 'Building D', project: 'Palm District', floors: 10, units: 96, sold: 61, conversionPct: 64, handover: 'Q1 2027', status: 'Under Construction' },
  { building: 'Building E', project: 'Palm District', floors: 10, units: 92, sold: 54, conversionPct: 59, handover: 'Q1 2027', status: 'Under Construction' },
  { building: 'Cedar 1', project: 'Cedar Residences', floors: 8, units: 72, sold: 64, conversionPct: 89, handover: 'Delivered', status: 'Delivered' },
  { building: 'Cedar 2', project: 'Cedar Residences', floors: 8, units: 74, sold: 61, conversionPct: 82, handover: 'Q3 2026', status: 'Launched' },
  { building: 'Tower North', project: 'Skyline Business Park', floors: 22, units: 96, sold: 38, conversionPct: 40, handover: 'Q2 2028', status: 'Under Construction' },
  { building: 'WA Block 1', project: 'West Avenue', floors: 6, units: 68, sold: 14, conversionPct: 21, handover: 'Q4 2028', status: 'Pre-launch' },
];

// Per-building "sold" count used on the Project Detail > Buildings tab, DERIVED (not authored) —
// formula: units = floors * unitsPerFloor; sold = round(units * (0.5 + (charCodeAt(0) of building key % 7) / 20))
// This produces different sold counts than BUILDINGS_TABLE above for the same buildings (e.g. Building A:
// 104 units -> formula gives a different sold figure than the authored 78). Flagged as an internal
// inconsistency in the source prototype — pick one source of truth when building the real data model.

// NOTE / gap: BUILDING_LAYOUTS' floors * unitsPerFloor also doesn't always match BUILDINGS_TABLE's `units`
// column exactly (e.g. North Hills Building A: 12 floors * 8/floor = 96, but the table row says 104 units).
// Both are preserved here verbatim as authored; reconciling them is a patch the real app will need to make.
