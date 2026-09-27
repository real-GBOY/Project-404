import type { Json } from "../../../../../core/kernel/db/json.js";
import type { ColumnType } from "kysely";
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type hotel_guest_notes = {
  id: string;
  organization_id: string;
  guest_id: string;
  author_id: string;
  body: string;
  created_at: Generated<Timestamp>;
};
export type hotel_guests = {
  id: string;
  organization_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  /**
   * ISO 3166-1 alpha-2
   */
  nationality: string | null;
  /**
   * @kyselyType('national_id' | 'passport' | null)
   */
  id_document_type: "national_id" | "passport" | null | null;
  id_document_number: string | null;
  preferences: string | null;
  vip: Generated<boolean>;
  created_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_room_types = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  description: string | null;
  capacity: number;
  beds: string;
  base_rate: string;
  /**
   * @kyselyType(Json<string[]>)
   */
  amenities: Generated<Json<string[]>>;
  sort_order: Generated<number>;
  archived_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_rooms = {
  id: string;
  organization_id: string;
  number: string;
  floor: number;
  room_type_id: string;
  /**
   * @kyselyType('clean' | 'dirty' | 'cleaning' | 'inspected')
   */
  housekeeping_status: Generated<"clean" | "dirty" | "cleaning" | "inspected">;
  /**
   * @kyselyType('in_service' | 'maintenance' | 'out_of_service')
   */
  service_status: Generated<"in_service" | "maintenance" | "out_of_service">;
  notes: string | null;
  archived_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_settings = {
  organization_id: string;
  hotel_name: string;
  time_zone: Generated<string>;
  /**
   * @kyselyType('EGP')
   */
  currency: Generated<"EGP">;
  /**
   * "HH:MM", hotel-local
   */
  check_in_time: Generated<string>;
  /**
   * "HH:MM", hotel-local
   */
  check_out_time: Generated<string>;
  tax_rate: Generated<string>;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type HotelTables = {
  hotel_guest_notes: hotel_guest_notes;
  hotel_guests: hotel_guests;
  hotel_room_types: hotel_room_types;
  hotel_rooms: hotel_rooms;
  hotel_settings: hotel_settings;
};
