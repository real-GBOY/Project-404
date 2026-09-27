import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useGuests, type Guest } from "@/api/guests";
import {
  SOURCE_LABEL,
  useAvailability,
  useCreateReservation,
  useFreeRooms,
  type AvailabilityResult,
  type ReservationSource,
} from "@/api/reservations";
import { useAuth } from "@/features/auth/use-auth";
import { GuestDialog } from "@/features/guests/guest-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  CheckboxField,
  FormError,
  InputField,
  SelectField,
  TextAreaField,
} from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { addIsoDays, formatEgp, formatIsoDate, hotelToday, isoDaysBetween } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";

/**
 * New reservation (a design gap, composed from the design's cards, pills and form fields):
 * stay → availability with SERVER quotes → room type (+ optional specific room) → guest → create.
 * The page never computes a price; it shows the server's quote and the server re-quotes on save.
 */
export function NewReservationPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();
  const today = hotelToday();
  const [arrival, setArrival] = useState(today);
  const [departure, setDeparture] = useState(addIsoDays(today, 2));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [discountCode, setDiscountCode] = useState("");
  const [choice, setChoice] = useState<AvailabilityResult | null>(null);
  const [roomId, setRoomId] = useState("");
  const [guest, setGuest] = useState<Guest | null>(null);
  const [source, setSource] = useState<ReservationSource>("phone");
  const [notes, setNotes] = useState("");
  const [confirmNow, setConfirmNow] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const nights = isoDaysBetween(arrival, departure);
  const datesValid = nights >= 1 && nights <= 30 && arrival >= today;
  const code = useDebouncedValue(discountCode.trim().toUpperCase());
  const availability = useAvailability(
    { arrival, departure, adults, children, discountCode: code },
    datesValid,
  );
  const create = useCreateReservation();

  // A new search invalidates the selected room type.
  const selected = choice
    ? (availability.data?.results.find((r) => r.roomType.id === choice.roomType.id) ?? null)
    : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected || !guest) return;
    setError(null);
    try {
      const created = await create.mutateAsync({
        guestId: guest.id,
        roomTypeId: selected.roomType.id,
        roomId: roomId || null,
        arrival,
        departure,
        adults,
        children,
        source,
        notes: notes.trim() || null,
        discountCode: code || null,
        confirm: confirmNow,
      });
      toast(`${created.code} booked — room ${created.roomNumber}`);
      navigate(`/reservations/${created.id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: "/reservations", label: "Back to Reservations" }}
        title="New Reservation"
      />
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>1 · Stay</CardTitle>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <InputField
                label="Check-in"
                type="date"
                min={today}
                required
                value={arrival}
                onChange={(e) => {
                  setArrival(e.target.value);
                  if (e.target.value >= departure) setDeparture(addIsoDays(e.target.value, 1));
                }}
              />
              <InputField
                label="Check-out"
                type="date"
                min={addIsoDays(arrival, 1)}
                required
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
              />
              <InputField
                label="Adults"
                type="number"
                min={1}
                max={12}
                value={adults}
                onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))}
              />
              <InputField
                label="Children"
                type="number"
                min={0}
                max={12}
                value={children}
                onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
              />
              <InputField
                label="Discount code"
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                placeholder="Optional"
              />
            </div>
            {!datesValid ? (
              <p className="m-0 mt-3 text-small font-semibold text-danger">
                Choose a stay of 1–30 nights starting today or later.
              </p>
            ) : null}
          </Card>

          <Card>
            <CardTitle>
              2 · Room type{" "}
              {datesValid ? (
                <span className="font-normal text-muted">
                  · {nights} {nights === 1 ? "night" : "nights"}, {formatIsoDate(arrival)} →{" "}
                  {formatIsoDate(departure)}
                </span>
              ) : null}
            </CardTitle>
            {!datesValid ? null : availability.isLoading ? (
              <LoadingState label="Checking availability…" />
            ) : availability.error ? (
              <ErrorState error={availability.error} />
            ) : (
              <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
                {availability.data!.results.map((r) => {
                  const active = selected?.roomType.id === r.roomType.id;
                  return (
                    <li key={r.roomType.id}>
                      <button
                        type="button"
                        disabled={!r.bookable}
                        aria-pressed={active}
                        onClick={() => {
                          setChoice(r);
                          setRoomId("");
                        }}
                        className={cn(
                          "w-full cursor-pointer rounded-inner border bg-surface p-3.5 text-left disabled:cursor-not-allowed disabled:opacity-55",
                          active
                            ? "border-primary ring-2 ring-primary-soft"
                            : "border-border hover:border-primary",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-body font-bold">{r.roomType.name}</div>
                          <div className="text-body font-extrabold">
                            {r.quote ? formatEgp(r.quote.total) : "—"}
                          </div>
                        </div>
                        <div className="mt-1 text-label text-muted">
                          {r.roomType.beds} · up to {r.roomType.capacity} guests
                        </div>
                        <div
                          className={cn(
                            "mt-2 text-label font-semibold",
                            r.bookable ? "text-success" : "text-danger",
                          )}
                        >
                          {r.bookable
                            ? `${r.availableRooms} room${r.availableRooms === 1 ? "" : "s"} free`
                            : r.unavailableReason}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {selected ? (
              <RoomPicker
                roomTypeId={selected.roomType.id}
                arrival={arrival}
                departure={departure}
                value={roomId}
                onChange={setRoomId}
              />
            ) : null}
          </Card>

          <GuestPicker guest={guest} onChange={setGuest} canCreate={auth.can("create:guest")} />

          <Card>
            <CardTitle>4 · Details</CardTitle>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SelectField
                label="Source"
                value={source}
                onChange={(e) => setSource(e.target.value as ReservationSource)}
              >
                {(Object.keys(SOURCE_LABEL) as ReservationSource[]).map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </SelectField>
              <div className="flex items-end pb-2.5">
                <CheckboxField
                  label="Confirm now"
                  checked={confirmNow}
                  onChange={(e) => setConfirmNow(e.target.checked)}
                />
              </div>
            </div>
            <TextAreaField
              className="mt-4"
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Card>
        </div>

        <Card className="self-start xl:sticky xl:top-0">
          <CardTitle>Summary</CardTitle>
          {selected?.quote ? (
            <>
              <div className="mb-1 text-body font-bold">{selected.roomType.name}</div>
              <div className="mb-3 text-label text-muted">
                {formatIsoDate(arrival)} → {formatIsoDate(departure)} · {adults + children} guests
              </div>
              <ul className="m-0 mb-2 list-none p-0">
                {selected.quote.nights.map((n) => (
                  <li key={n.date} className="flex justify-between py-0.5 text-small">
                    <span className="text-muted">
                      {formatIsoDate(n.date)}
                      {n.rule ? (
                        <span className="ml-1 text-label text-faint">· {n.rule}</span>
                      ) : null}
                    </span>
                    <span>{formatEgp(n.rate)}</span>
                  </li>
                ))}
              </ul>
              {selected.quote.discountAmount > 0 ? (
                <div className="flex justify-between border-t border-border-subtle pt-2 text-small">
                  <span className="text-muted">Discount ({selected.quote.discountCode})</span>
                  <span className="font-semibold text-success">
                    −{formatEgp(selected.quote.discountAmount)}
                  </span>
                </div>
              ) : null}
              <div className="mt-2 flex justify-between border-t border-border-subtle pt-2.5">
                <span className="font-semibold">Total (before VAT)</span>
                <span className="font-extrabold">{formatEgp(selected.quote.total)}</span>
              </div>
            </>
          ) : (
            <p className="m-0 text-small text-muted">
              Choose dates and a room type to see the price.
            </p>
          )}
          <div className="mt-4 border-t border-border-subtle pt-4 text-small">
            <span className="text-faint">Guest: </span>
            <span className="font-semibold">{guest?.fullName ?? "not chosen"}</span>
          </div>
          <div className="mt-3">
            <FormError message={error} />
          </div>
          <Button
            type="submit"
            className="mt-4 w-full"
            disabled={!selected?.bookable || !guest || create.isPending}
          >
            {create.isPending ? "Booking…" : confirmNow ? "Book & confirm" : "Book as pending"}
          </Button>
        </Card>
      </form>
    </>
  );
}

function RoomPicker(props: {
  roomTypeId: string;
  arrival: string;
  departure: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const free = useFreeRooms(
    { roomTypeId: props.roomTypeId, arrival: props.arrival, departure: props.departure },
    true,
  );
  return (
    <SelectField
      className="mt-4 max-w-[320px]"
      label="Room"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    >
      <option value="">Assign automatically</option>
      {(free.data ?? []).map((r) => (
        <option key={r.id} value={r.id}>
          Room {r.number}
        </option>
      ))}
    </SelectField>
  );
}

function GuestPicker({
  guest,
  onChange,
  canCreate,
}: {
  guest: Guest | null;
  onChange: (g: Guest | null) => void;
  canCreate: boolean;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const q = useDebouncedValue(query.trim());
  const results = useGuests({ q, page: 1, pageSize: 6 });

  return (
    <Card>
      <CardTitle>3 · Guest</CardTitle>
      {guest ? (
        <div className="flex items-center gap-3">
          <Avatar name={guest.fullName} />
          <div className="min-w-0 flex-1">
            <div className="text-body font-bold">{guest.fullName}</div>
            <div className="text-label text-muted">{guest.phone ?? guest.email}</div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onChange(null)}>
            Change
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2.5">
            <input
              type="search"
              aria-label="Find guest"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find by name, phone or email…"
              className="min-w-0 flex-1 rounded-button border border-border bg-canvas px-3.5 py-2.5 text-body outline-none placeholder:text-faint focus:border-primary"
            />
            {canCreate ? (
              <Button variant="secondary" onClick={() => setCreating(true)}>
                + New guest
              </Button>
            ) : null}
          </div>
          {q ? (
            <ul className="m-0 mt-3 list-none p-0">
              {(results.data?.items ?? []).map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => onChange(g)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-canvas"
                  >
                    <Avatar name={g.fullName} size="sm" />
                    <span className="text-small font-semibold">{g.fullName}</span>
                    <span className="text-label text-faint">{g.phone ?? g.email}</span>
                  </button>
                </li>
              ))}
              {results.data && results.data.items.length === 0 ? (
                <li className="px-2 py-2 text-small text-muted">No guest matches “{q}”.</li>
              ) : null}
            </ul>
          ) : null}
        </>
      )}
      {creating ? <GuestDialog onClose={() => setCreating(false)} onCreated={onChange} /> : null}
    </Card>
  );
}
