/**
 * Room state (docs/architecture.md §4). A room has TWO stored facts — how clean it is and whether
 * it can be sold — and its occupancy comes from reservations. The single status staff see on the
 * rooms board is DERIVED here, never stored, so no code path can "make a room available" by
 * writing one column while a maintenance block or a dirty room says otherwise.
 */
export type HousekeepingStatus = "clean" | "dirty" | "cleaning" | "inspected";
export type ServiceStatus = "in_service" | "maintenance" | "out_of_service";

export const HOUSEKEEPING_STATUSES: readonly HousekeepingStatus[] = [
  "clean",
  "dirty",
  "cleaning",
  "inspected",
];
export const SERVICE_STATUSES: readonly ServiceStatus[] = [
  "in_service",
  "maintenance",
  "out_of_service",
];

export type RoomDisplayStatus =
  "out_of_service" | "maintenance" | "occupied" | "cleaning" | "dirty" | "reserved" | "available";

export interface RoomOccupancy {
  /** A guest is checked in to this room right now. */
  occupied: boolean;
  /** A confirmed arrival is due into this room today. */
  arrivingToday: boolean;
}

export const NO_OCCUPANCY: RoomOccupancy = { occupied: false, arrivingToday: false };

/**
 * Precedence: OUT_OF_SERVICE > MAINTENANCE > OCCUPIED > CLEANING > DIRTY > RESERVED > AVAILABLE.
 * A room is sellable-ready ("available") only when it is in service, not occupied, and clean or
 * inspected.
 */
export function displayStatus(
  housekeeping: HousekeepingStatus,
  service: ServiceStatus,
  occupancy: RoomOccupancy = NO_OCCUPANCY,
): RoomDisplayStatus {
  if (service === "out_of_service") return "out_of_service";
  if (service === "maintenance") return "maintenance";
  if (occupancy.occupied) return "occupied";
  if (housekeeping === "cleaning") return "cleaning";
  if (housekeeping === "dirty") return "dirty";
  if (occupancy.arrivingToday) return "reserved";
  return "available";
}
