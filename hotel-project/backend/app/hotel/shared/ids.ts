import { createPrefixedId, hasIdPrefix } from "@core/kernel/id.js";

/**
 * Prefixed identifiers for hotel domain rows, mirroring Core's `newId` convention: the format is
 * Core's `createPrefixedId` (`core/kernel/id.ts`); this file owns only the hotel prefix set.
 *
 *   hotelId("rom") -> "rom_V1StGXR8Z5jdHi6BMyT4c"
 */
export type HotelIdPrefix =
  | "rmt" // room type
  | "rom" // room
  | "gst" // guest
  | "gnt" // guest note
  | "rtr" // rate rule
  | "dsc" // discount code
  | "rsv" // reservation
  | "ral" // room allocation
  | "rsh" // reservation status history
  | "fch" // folio charge
  | "pay" // payment
  | "inv" // invoice
  | "ivi" // invoice item
  | "hkt" // housekeeping task
  | "mtk" // maintenance ticket
  | "mte"; // maintenance event

export const hotelId = (prefix: HotelIdPrefix): string => createPrefixedId(prefix);

export const hasHotelPrefix = (id: string, prefix: HotelIdPrefix): boolean =>
  hasIdPrefix(id, prefix);
