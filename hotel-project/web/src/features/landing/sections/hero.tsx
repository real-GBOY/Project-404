import { useId, useRef, useState, type SubmitEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowButton, ArrowLink, Reveal } from "../components/ui";
import { Icon } from "../components/icon";
import { booking, hero, rooms } from "../data";

const FIELD =
  "w-full rounded-lg border border-field bg-transparent px-4 py-2 sm:px-5 text-muted tracking-[0.05rem] sm:tracking-[0.1rem] transition-colors focus-within:border-body";

const toIso = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIso(d);
};
// "Thu, 28 Mar 2024" — the design's format (en-GB would print "Sept").
const pretty = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", o);
  return `${part({ weekday: "short" })}, ${d.getDate()} ${part({ month: "short" })} ${d.getFullYear()}`;
};
const nightsBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000);

/** Styled date field (template look) backed by the native picker for accessibility and mobile. */
function DateField({ label, value, min, onChange }: { label: string; value: string; min: string; onChange: (v: string) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="my-6">
      <label htmlFor={id} className="mb-2 block uppercase">
        {label}
      </label>
      <div className={`${FIELD} relative`}>
        <span aria-hidden="true" className="block truncate pe-8">{pretty(value)}</span>
        <Icon name="calendar" size={25} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-body" />
        <input
          ref={input}
          id={id}
          type="date"
          required
          value={value}
          min={min}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={() => input.current?.showPicker?.()}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  );
}

function SelectField({ label, value, options, unit, onChange }: { label: string; value: number; options: number[]; unit: [string, string]; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="my-6">
      <label htmlFor={id} className="mb-2 block uppercase">
        {label}
      </label>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className={`${FIELD} cursor-pointer appearance-none`}>
          {options.map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? unit[0] : unit[1]}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={18} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-body" />
      </div>
    </div>
  );
}

function BookingForm() {
  const today = toIso(new Date());
  const [checkIn, setCheckIn] = useState(addDays(today, 1));
  const [checkOut, setCheckOut] = useState(addDays(today, 3));
  const [roomCount, setRoomCount] = useState(1);
  const [guests, setGuests] = useState(booking.defaultGuests);
  const [result, setResult] = useState<string | null>(null);

  const changeCheckIn = (v: string) => {
    setCheckIn(v);
    if (nightsBetween(v, checkOut) < 1) setCheckOut(addDays(v, 1));
    setResult(null);
  };

  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    // Demo availability until the hotel backend exists: rooms that fit the party size.
    const perRoom = Math.ceil(guests / roomCount);
    const fits = rooms.filter((r) => Number(r.capacity.match(/\d+/)?.[0] ?? 0) >= perRoom);
    const nights = nightsBetween(checkIn, checkOut);
    const from = Math.min(...(fits.length ? fits : rooms).map((r) => r.price));
    setResult(
      fits.length
        ? `${fits.length} room types available for ${nights} night${nights > 1 ? "s" : ""}, from $${from}/night.`
        : "No single room fits that many guests — try adding another room.",
    );
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-6 sm:p-12 lg:ms-12" aria-label={booking.title}>
      <h3 className="display-5">{booking.title}</h3>
      <DateField label="Check-In" value={checkIn} min={today} onChange={changeCheckIn} />
      <DateField
        label="Check-Out"
        value={checkOut}
        min={addDays(checkIn, 1)}
        onChange={(v) => {
          setCheckOut(v);
          setResult(null);
        }}
      />
      <SelectField label="Rooms" value={roomCount} options={booking.roomOptions} unit={["Room", "Rooms"]} onChange={setRoomCount} />
      <SelectField label="Guests" value={guests} options={booking.guestOptions} unit={["Adult", "Adults"]} onChange={setGuests} />
      <div className="grid">
        <ArrowButton type="submit" className="mt-4">
          {booking.submitLabel}
        </ArrowButton>
      </div>
      <AnimatePresence>
        {result && (
          <motion.p
            role="status"
            className="mt-4 text-center text-sm text-primary"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {result}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}

export function Hero() {
  return (
    <section id="home">
      <Reveal className="px-side">
        <div
          className="flex min-h-[85vh] rounded-4xl bg-cover bg-center bg-no-repeat py-12 lg:py-0"
          style={{ backgroundImage: `url(${hero.image})` }}
        >
          <div className="m-auto flex w-full flex-wrap items-center px-4 pt-12 sm:px-6 lg:pt-0 lg:px-0">
            <div className="w-full lg:ms-[8.333%] lg:w-5/12 xl:w-1/2">
              <h2 className="display-1">{hero.title}</h2>
              <ArrowLink href={hero.cta.href} className="mt-4">
                {hero.cta.label}
              </ArrowLink>
            </div>
            <div className="mt-12 w-full max-w-140 lg:mt-0 lg:w-5/12 lg:max-w-none xl:w-1/3">
              <BookingForm />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
