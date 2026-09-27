import type { Json } from "../../../../../core/kernel/db/json.js";
import type { ColumnType } from "kysely";
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type hotel_counters = {
  organization_id: string;
  name: string;
  value: string;
};
export type hotel_discounts = {
  id: string;
  organization_id: string;
  code: string;
  description: string | null;
  percent_off: string;
  valid_from: Timestamp | null;
  valid_to: Timestamp | null;
  archived_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
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
export type hotel_rate_rules = {
  id: string;
  organization_id: string;
  name: string;
  /**
   * @kyselyType('seasonal' | 'weekend' | 'promotion')
   */
  kind: "seasonal" | "weekend" | "promotion";
  room_type_id: string | null;
  start_date: Timestamp | null;
  end_date: Timestamp | null;
  /**
   * 0 = Sunday … 6 = Saturday (the NIGHT that starts on that weekday)
   */
  days_of_week: number[];
  /**
   * @kyselyType('percent' | 'fixed_rate')
   */
  adjustment_type: "percent" | "fixed_rate";
  adjustment_value: string;
  min_nights: number | null;
  priority: Generated<number>;
  archived_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_reservation_status_history = {
  id: string;
  /**
   * orders transitions within one transaction (shared CURRENT_TIMESTAMP)
   */
  seq: Generated<string>;
  organization_id: string;
  reservation_id: string;
  from_status: string | null;
  to_status: string;
  actor_id: string | null;
  reason: string | null;
  created_at: Generated<Timestamp>;
};
export type hotel_reservations = {
  id: string;
  organization_id: string;
  code: string;
  guest_id: string;
  room_type_id: string;
  /**
   * @kyselyType('pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show')
   */
  status: "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled" | "no_show";
  /**
   * @kyselyType('direct' | 'phone' | 'walk_in' | 'website' | 'booking_com' | 'expedia')
   */
  source: "direct" | "phone" | "walk_in" | "website" | "booking_com" | "expedia";
  arrival: Timestamp;
  departure: Timestamp;
  adults: number;
  children: Generated<number>;
  /**
   * @kyselyType(Json<Array<{ date: string; rate: number; rule: string | null }>>)
   */
  nightly_rates: Json<Array<{ date: string; rate: number; rule: string | null }>>;
  room_total: string;
  discount_code: string | null;
  discount_amount: Generated<string>;
  total: string;
  notes: string | null;
  cancellation_reason: string | null;
  created_by: string | null;
  confirmed_at: Timestamp | null;
  checked_in_at: Timestamp | null;
  checked_out_at: Timestamp | null;
  cancelled_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type hotel_room_allocations = {
  id: string;
  organization_id: string;
  room_id: string;
  /**
   * @kyselyType('reservation' | 'block')
   */
  kind: "reservation" | "block";
  reservation_id: string | null;
  active: Generated<boolean>;
  reason: string | null;
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
  hotel_counters: hotel_counters;
  hotel_discounts: hotel_discounts;
  hotel_guest_notes: hotel_guest_notes;
  hotel_guests: hotel_guests;
  hotel_rate_rules: hotel_rate_rules;
  hotel_reservation_status_history: hotel_reservation_status_history;
  hotel_reservations: hotel_reservations;
  hotel_room_allocations: hotel_room_allocations;
  hotel_room_types: hotel_room_types;
  hotel_rooms: hotel_rooms;
  hotel_settings: hotel_settings;
};
