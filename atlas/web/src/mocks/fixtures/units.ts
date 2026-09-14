// Extracted verbatim from the design prototype's `UNIT_TYPES` class field, plus the pure derivation
// formulas from `unitAt()` and `unitColors()`.
//
// IMPORTANT: the prototype does NOT hold a fixed array of unit rows. Units are generated procedurally
// per (building, floor, index) using a deterministic hash, so the same unit id always renders the same
// status/type/price within a session, but there is no authored "UNITS" list to extract. The real app
// will need to decide whether to keep this procedural-generation approach or materialize a fixed table
// (recommended for a real backend/mock-data layer — see gap note at the bottom).

export interface UnitTypeFixture {
  label: string;
  /** Area in square meters */
  areaSqm: number;
  /** Base price in EGP millions */
  basePriceEgpM: number;
}

// UNIT_TYPES: cycled by (floor + index) % 8 to assign a type to a generated unit.
export const UNIT_TYPES: UnitTypeFixture[] = [
  { label: '1-Bed', areaSqm: 78, basePriceEgpM: 2.9 },
  { label: '2-Bed', areaSqm: 126, basePriceEgpM: 4.2 },
  { label: '2-Bed', areaSqm: 132, basePriceEgpM: 4.4 },
  { label: '3-Bed', areaSqm: 178, basePriceEgpM: 6.4 },
  { label: '3-Bed', areaSqm: 186, basePriceEgpM: 6.8 },
  { label: '4-Bed', areaSqm: 232, basePriceEgpM: 9.1 },
  { label: 'Penthouse', areaSqm: 284, basePriceEgpM: 12.8 },
  { label: 'Duplex', areaSqm: 246, basePriceEgpM: 10.4 },
];

import { TOKEN_COLORS } from "@/styles/colors";

export type UnitStatus = 'Sold' | 'Available' | 'Reserved' | 'On Hold' | 'Unavailable';

// unitColors(status) -> [background, foreground, border] used to paint the floor-plate grid.
// Note: "Unavailable" uses plain canvas/border rather than the dedicated
// unitUnavailableFill/Border tokens (#F2F2EE/#D8D4CB) — that's how the design prototype
// actually authored it, kept verbatim rather than "corrected" to match the token names.
export const UNIT_STATUS_COLORS: Record<UnitStatus, [bg: string, fg: string, border: string]> = {
  Sold: [TOKEN_COLORS.unit.unitSold, TOKEN_COLORS.brand.primaryForeground, TOKEN_COLORS.unit.unitSoldBorder],
  Available: [TOKEN_COLORS.unit.unitAvailableFill, TOKEN_COLORS.unit.unitAvailableFg, TOKEN_COLORS.unit.unitAvailableBorder],
  Reserved: [TOKEN_COLORS.unit.unitReservedFill, TOKEN_COLORS.unit.unitReservedFg, TOKEN_COLORS.unit.unitReservedBorder],
  'On Hold': [TOKEN_COLORS.unit.unitHoldFill, TOKEN_COLORS.unit.unitHoldFg, TOKEN_COLORS.unit.unitHoldBorder],
  Unavailable: [TOKEN_COLORS.surface.canvas, TOKEN_COLORS.unit.unitUnavailableFg, TOKEN_COLORS.border.border],
};

// unitAt(buildingKey, floor, idx, totalFloors) formula, verbatim:
//   hash   = (floor*17 + idx*29 + buildingKey.charCodeAt(0)*7) % 100
//   status = hash < 50 ? 'Sold' : hash < 78 ? 'Available' : hash < 89 ? 'Reserved' : hash < 95 ? 'On Hold' : 'Unavailable'
//   id     = `${buildingKey}-${String(floor).padStart(2,'0')}${String(idx).padStart(2,'0')}`
//   type   = UNIT_TYPES[(floor + idx) % 8]
//   price  = type.basePriceEgpM * (1 + floor * 0.014) * (buildingKey === 'C' ? 1.06 : 1)   // EGP millions
// A manual per-unit `unitOverrides` map (e.g. { 'B-1204': 'Reserved' }) can force a status regardless
// of the hash — used by the prototype to script the live "Unit B-1204 reserved" demo notification.

// Unit detail (when a unit is opened) derives further fields, formulas verbatim:
//   totalPrice (EGP)     = round(price * 1_000_000)
//   paidToDate (EGP)     = status === 'Sold' ? round(total*0.299) : status === 'Reserved' ? round(total*0.03) : 0
//   remaining (EGP)      = total - paidToDate
//   paidPct              = total ? paidToDate/total*100 : 0
//   customer / agent     = hardcoded per status in the prototype (Sold -> Mona Fahmy / Mohamed Adel,
//                          Reserved -> Tarek ElGohary / Ahmed Mohamed, else unassigned) — these are
//                          prototype placeholders, not a real customer-to-unit assignment model.

// GAP: because unit rows are procedurally generated rather than authored, there is no fixed "row count"
// for units — the effective inventory size comes from BUILDING_LAYOUTS (floors * unitsPerFloor per
// building) which totals 1,286 units project-wide per the prototype's own copy ("1,286 units" appears
// in the Buildings/Availability screen subtitles), matching PROJECTS' sum of totalUnits (412+336+218+184+136=1286).
// The real app should either keep procedural generation (port the formulas above) or materialize a
// concrete units table sized to match BUILDING_LAYOUTS.
