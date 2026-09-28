/**
 * The HotelOS public booking API, as the website uses it. The site names its hotel by slug;
 * `/api` is proxied to the HotelOS backend in development and set per deployment in production.
 */
const API = (import.meta.env.VITE_HOTEL_API as string | undefined) ?? "/api";
const SLUG = (import.meta.env.VITE_HOTEL_SLUG as string | undefined) ?? "hotel-transylvania";
const BASE = `${API.replace(/\/$/, "")}/public/hotels/${SLUG}`;

export interface Offer {
  roomType: { id: string; name: string; capacity: number; beds: string; amenities: string[] };
  fewLeft: number | null;
  nights: Array<{ date: string; rate: number }>;
  roomTotal: number;
  discountAmount: number;
  total: number;
  tax: number;
  grandTotal: number;
}

export interface Availability {
  arrival: string;
  departure: string;
  nights: number;
  currency: string;
  results: Offer[];
}

export interface Confirmation {
  code: string;
  status: string;
  guestName: string;
  roomTypeName: string;
  arrival: string;
  departure: string;
  nights: number;
  adults: number;
  total: number;
  tax: number;
  grandTotal: number;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  hotelName: string;
}

export interface GuestDetails {
  fullName: string;
  email: string;
  phone: string;
  notes: string;
}

/** A failure the guest can read. */
export class BookingError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new BookingError("We couldn't reach the hotel. Check your connection and try again.", "network");
  }
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: undefined })
    | { error?: { code?: string; message?: string; details?: { fields?: Array<{ message: string }> } } }
    | null;
  if (res.ok) return body as T;
  const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
  if (res.status === 429) {
    const wait = Number(res.headers.get("Retry-After") ?? "60");
    throw new BookingError(
      `Too many attempts — please try again in ${wait < 90 ? `${wait} seconds` : `${Math.ceil(wait / 60)} minutes`}.`,
      "rate_limited",
    );
  }
  if (err?.code === "reservation.no_availability") {
    throw new BookingError("That room was just taken for these dates. Please choose another.", err.code);
  }
  if (res.status >= 400 && res.status < 500 && err?.message) {
    throw new BookingError(err.message, err.code ?? "rejected");
  }
  throw new BookingError("Something went wrong on our side. Please try again, or call the hotel.", "server");
}

export function searchAvailability(q: { arrival: string; departure: string; adults: number }) {
  const params = new URLSearchParams({
    arrival: q.arrival,
    departure: q.departure,
    adults: String(q.adults),
  });
  return call<Availability>(`/availability?${params}`);
}

/** One key per booking attempt: a retry (or double-click) of the same attempt can't book twice. */
export function newBookingKey(): string {
  return `web_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function createBooking(
  input: { roomTypeId: string; arrival: string; departure: string; adults: number; guest: GuestDetails },
  idempotencyKey: string,
) {
  return call<Confirmation>("/bookings", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      roomTypeId: input.roomTypeId,
      arrival: input.arrival,
      departure: input.departure,
      adults: input.adults,
      notes: input.guest.notes.trim() || null,
      guest: {
        fullName: input.guest.fullName.trim(),
        email: input.guest.email.trim(),
        phone: input.guest.phone.trim() || null,
      },
    }),
  });
}

export const formatMoney = (amount: number, currency: string) =>
  `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)} ${currency}`;
