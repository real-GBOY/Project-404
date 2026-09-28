import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowButton } from "../landing/components/ui";
import {
  BookingError,
  createBooking,
  formatMoney,
  newBookingKey,
  searchAvailability,
  type Availability,
  type Confirmation,
  type GuestDetails,
  type Offer,
} from "./api";

export interface StaySearch {
  arrival: string;
  departure: string;
  adults: number;
}

type Step =
  | { kind: "loading" }
  | { kind: "rooms"; availability: Availability }
  | { kind: "details"; availability: Availability; offer: Offer }
  | { kind: "done"; confirmation: Confirmation }
  | { kind: "error"; message: string };

const INPUT =
  "w-full rounded-lg border border-field bg-transparent px-4 py-3 text-body transition-colors outline-none focus:border-body";

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/**
 * Book a stay on the hotel's own website: real availability and prices from HotelOS, then the
 * guest's details, then a confirmation with the booking reference. Payment is taken at the hotel.
 * The whole attempt shares one Idempotency-Key, so a double-click or retry books exactly once.
 */
export function BookingDialog({ search, onClose }: { search: StaySearch; onClose: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    searchAvailability(search)
      .then((availability) => live && setStep({ kind: "rooms", availability }))
      .catch((err: unknown) =>
        live &&
        setStep({
          kind: "error",
          message: err instanceof BookingError ? err.message : "Something went wrong. Please try again.",
        }),
      );
    return () => {
      live = false;
    };
  }, [search]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("h2, button, input")?.focus();
  }, [step.kind]);

  const title =
    step.kind === "details" ? "Your details" : step.kind === "done" ? "You're booked" : "Choose your room";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-4 py-10">
      <button
        type="button"
        aria-label="Close booking"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-ink/40"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        className="relative w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-10"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id="booking-title" tabIndex={-1} className="display-5 outline-none">
              {title}
            </h2>
            {step.kind !== "done" ? (
              <p className="mt-1 text-sm text-muted">
                {prettyDate(search.arrival)} → {prettyDate(search.departure)} · {search.adults}{" "}
                {search.adults === 1 ? "guest" : "guests"}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-full px-3 py-1 text-2xl leading-none text-muted hover:text-ink"
          >
            ×
          </button>
        </div>

        {step.kind === "loading" ? (
          <p role="status" className="py-10 text-center text-muted">
            Checking live availability…
          </p>
        ) : step.kind === "error" ? (
          <p role="alert" className="rounded-lg bg-secondary px-5 py-4 text-body">
            {step.message}
          </p>
        ) : step.kind === "rooms" ? (
          <Rooms
            availability={step.availability}
            onChoose={(offer) => setStep({ kind: "details", availability: step.availability, offer })}
          />
        ) : step.kind === "details" ? (
          <Details
            search={search}
            availability={step.availability}
            offer={step.offer}
            onBack={() => setStep({ kind: "rooms", availability: step.availability })}
            onBooked={(confirmation) => setStep({ kind: "done", confirmation })}
          />
        ) : (
          <Done c={step.confirmation} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function Rooms({ availability, onChoose }: { availability: Availability; onChoose: (o: Offer) => void }) {
  if (availability.results.length === 0) {
    return (
      <p role="status" className="rounded-lg bg-secondary px-5 py-6 text-center">
        We're fully booked for these dates. Please try other dates — or call us, we'll do our best.
      </p>
    );
  }
  return (
    <ul className="grid gap-4" aria-label="Available rooms">
      {availability.results.map((o) => (
        <li
          key={o.roomType.id}
          className="flex flex-col gap-4 rounded-xl border border-field p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <h3 className="font-heading text-2xl text-ink">{o.roomType.name}</h3>
            <p className="mt-1 text-sm text-muted">
              {o.roomType.beds} · up to {o.roomType.capacity} guests
            </p>
            {o.fewLeft ? (
              <p className="mt-1 text-sm text-primary">
                Only {o.fewLeft} left at this price
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <div className="text-lg font-semibold text-ink">
              {formatMoney(o.grandTotal, availability.currency)}
            </div>
            <div className="text-xs text-muted">
              {availability.nights} {availability.nights === 1 ? "night" : "nights"} · incl. VAT
            </div>
            <button
              type="button"
              onClick={() => onChoose(o)}
              className="mt-3 w-full cursor-pointer rounded-btn bg-primary px-6 py-2.5 text-sm text-white transition-opacity hover:opacity-90 sm:w-auto"
            >
              Select
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Details({
  search,
  availability,
  offer,
  onBack,
  onBooked,
}: {
  search: StaySearch;
  availability: Availability;
  offer: Offer;
  onBack: () => void;
  onBooked: (c: Confirmation) => void;
}) {
  const [guest, setGuest] = useState<GuestDetails>({ fullName: "", email: "", phone: "", notes: "" });
  const [key] = useState(newBookingKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof GuestDetails) => (e: { target: { value: string } }) =>
    setGuest((g) => ({ ...g, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (guest.fullName.trim().length < 2) return setError("Please enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(guest.email.trim())) return setError("Please enter a valid email address.");
    setBusy(true);
    try {
      onBooked(
        await createBooking(
          { roomTypeId: offer.roomType.id, arrival: search.arrival, departure: search.departure, adults: search.adults, guest },
          key,
        ),
      );
    } catch (err) {
      setError(err instanceof BookingError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="rounded-xl bg-secondary px-5 py-4">
        <div className="flex justify-between gap-3">
          <span className="font-heading text-xl text-ink">{offer.roomType.name}</span>
          <span className="font-semibold text-ink">{formatMoney(offer.grandTotal, availability.currency)}</span>
        </div>
        <div className="mt-1 text-xs text-muted">
          Room {formatMoney(offer.total, availability.currency)}
          {offer.discountAmount > 0 ? ` (after ${formatMoney(offer.discountAmount, availability.currency)} off)` : ""} ·
          VAT {formatMoney(offer.tax, availability.currency)} · pay at the hotel
        </div>
      </div>
      <label className="grid gap-1.5 text-sm">
        Full name
        <input className={INPUT} autoComplete="name" value={guest.fullName} onChange={set("fullName")} required />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          Email
          <input className={INPUT} type="email" autoComplete="email" value={guest.email} onChange={set("email")} required />
        </label>
        <label className="grid gap-1.5 text-sm">
          Phone (optional)
          <input className={INPUT} type="tel" autoComplete="tel" value={guest.phone} onChange={set("phone")} />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm">
        Special requests (optional)
        <textarea className={INPUT} rows={3} maxLength={500} value={guest.notes} onChange={set("notes")} />
      </label>
      {error ? (
        <p role="alert" className="rounded-lg bg-secondary px-4 py-3 text-sm text-primary">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className="cursor-pointer text-sm text-muted underline underline-offset-4 hover:text-ink">
          ← Choose another room
        </button>
        <ArrowButton type="submit" disabled={busy}>
          {busy ? "Booking…" : "Confirm booking"}
        </ArrowButton>
      </div>
    </form>
  );
}

function Done({ c, onClose }: { c: Confirmation; onClose: () => void }) {
  return (
    <div className="grid gap-5" role="status">
      <p className="text-body">
        Thank you, {c.guestName.split(" ")[0]}. Your stay at {c.hotelName} is confirmed — we can't wait to welcome you.
      </p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-secondary px-5 py-5 text-sm">
        <dt className="text-muted">Booking reference</dt>
        <dd className="font-semibold text-ink" data-testid="booking-code">
          {c.code}
        </dd>
        <dt className="text-muted">Room</dt>
        <dd className="text-ink">{c.roomTypeName}</dd>
        <dt className="text-muted">Check-in</dt>
        <dd className="text-ink">
          {prettyDate(c.arrival)} from {c.checkInTime}
        </dd>
        <dt className="text-muted">Check-out</dt>
        <dd className="text-ink">
          {prettyDate(c.departure)} by {c.checkOutTime}
        </dd>
        <dt className="text-muted">Total (incl. VAT)</dt>
        <dd className="font-semibold text-ink">{formatMoney(c.grandTotal, c.currency)}</dd>
      </dl>
      <p className="text-sm text-muted">Payment is taken at the hotel. Keep your booking reference handy.</p>
      <div>
        <ArrowButton type="button" onClick={onClose}>
          Done
        </ArrowButton>
      </div>
    </div>
  );
}
