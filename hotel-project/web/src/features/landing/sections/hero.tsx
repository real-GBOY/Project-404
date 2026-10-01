import { useId, useRef, useState, type SubmitEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowButton, ArrowLink, Reveal } from "../components/ui";
import { Icon } from "../components/icon";
import { booking, hero } from "../data";
import { BookingDialog, type StaySearch } from "../../booking/booking-dialog";

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
// "Thu, 28 Mar 2024" format (en-GB would print "Sept").
// The weekday is dropped on the narrowest phones so the full date always fits.
function PrettyDate({ iso }: { iso: string }) {
  const d = new Date(`${iso}T00:00:00`);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", o);
  return (
    <>
      <span className="hidden min-[400px]:inline">{part({ weekday: "short" })}, </span>
      {d.getDate()} {part({ month: "short" })} {d.getFullYear()}
    </>
  );
}
const nightsBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86_400_000);

/** Styled date field backed by the native date picker for accessibility and mobile. */
function DateField({ label, value, min, onChange }: { label: string; value: string; min: string; onChange: (v: string) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="my-6">
      <label htmlFor={id} className="mb-2 block uppercase">
        {label}
      </label>
      <div className={`${FIELD} relative`}>
        <span aria-hidden="true" className="block truncate pe-8 max-[399px]:text-sm">
          <PrettyDate iso={value} />
        </span>
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
  const [guests, setGuests] = useState(booking.defaultGuests);
  const [search, setSearch] = useState<StaySearch | null>(null);

  const changeCheckIn = (v: string) => {
    setCheckIn(v);
    if (nightsBetween(v, checkOut) < 1) setCheckOut(addDays(v, 1));
  };

  // Live availability and booking come from HotelOS (features/booking).
  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    setSearch({ arrival: checkIn, departure: checkOut, adults: guests });
  };

  return (
    <>
    <form onSubmit={submit} className="rounded-2xl bg-white p-6 sm:p-10 lg:ms-6 lg:p-8 xl:ms-12 xl:p-12" aria-label={booking.title}>
      <h3 className="display-5">{booking.title}</h3>
      <DateField label="Check-In" value={checkIn} min={today} onChange={changeCheckIn} />
      <DateField label="Check-Out" value={checkOut} min={addDays(checkIn, 1)} onChange={setCheckOut} />
      <SelectField label="Guests" value={guests} options={booking.guestOptions} unit={["Adult", "Adults"]} onChange={setGuests} />
      <div className="grid">
        <ArrowButton type="submit" className="mt-4">
          {booking.submitLabel}
        </ArrowButton>
      </div>
    </form>
    {/* Outside the search form (no nested forms), portalled above the page. */}
    {search ? createPortal(<BookingDialog search={search} onClose={() => setSearch(null)} />, document.body) : null}
    </>
  );
}

export function Hero() {
  return (
    <section id="home">
      <Reveal className="px-side">
        <div
          className="flex min-h-[85vh] rounded-2xl bg-cover sm:rounded-4xl bg-center bg-no-repeat py-12 lg:py-0"
          // Cream fade from the left keeps the dark headline readable over a detailed photo.
          style={{
            backgroundImage: `linear-gradient(90deg, rgb(249 246 243 / 0.85) 0%, rgb(249 246 243 / 0.55) 40%, rgb(249 246 243 / 0) 70%), url(${hero.image})`,
          }}
        >
          <div className="m-auto flex w-full flex-wrap items-center px-4 pt-6 sm:px-8 sm:pt-12 lg:px-10 lg:pt-0 xl:px-0">
            <div className="w-full lg:w-1/2 xl:ms-[8.333%] xl:w-1/2">
              <h2 className="display-1">{hero.title}</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <ArrowLink href={hero.cta.href}>{hero.cta.label}</ArrowLink>
                <ArrowLink href={hero.demoCta.href} className="border border-body !bg-transparent">
                  {hero.demoCta.label}
                </ArrowLink>
              </div>
            </div>
            <div className="mt-10 w-full max-w-140 sm:mt-12 lg:mt-0 lg:w-1/2 lg:max-w-none xl:w-1/3">
              <BookingForm />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
