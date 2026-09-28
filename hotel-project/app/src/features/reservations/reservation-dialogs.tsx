import { useState, type FormEvent } from "react";
import { useFreeRooms, useReservationAction, type Reservation } from "@/api/reservations";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, InputField, SelectField, TextAreaField } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { addIsoDays, formatEgp, formatIsoDate, formatStay } from "@/lib/format";
import { useExtendStay } from "@/api/front-desk";

export function CancelDialog({
  reservation,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const action = useReservationAction(reservation.id);
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await action.mutateAsync({ kind: "cancel", reason: reason.trim() || null });
      toast(`${reservation.code} cancelled — room released`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title={`Cancel ${reservation.code}?`}
      description={`${reservation.guestName} · ${formatStay(reservation.arrival, reservation.departure)}. The room is released immediately.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Keep booking
          </Button>
          <Button size="sm" type="submit" form="cancel-form" disabled={action.isPending}>
            {action.isPending ? "Cancelling…" : "Cancel booking"}
          </Button>
        </>
      }
    >
      <form id="cancel-form" onSubmit={submit} className="flex flex-col gap-4">
        <TextAreaField
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <FormError message={error} />
      </form>
    </Dialog>
  );
}

export function ChangeRoomDialog({
  reservation,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const action = useReservationAction(reservation.id);
  const toast = useToast();
  const free = useFreeRooms(
    {
      roomTypeId: reservation.roomTypeId,
      arrival: reservation.arrival,
      departure: reservation.departure,
    },
    true,
  );
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const options = (free.data ?? []).filter((r) => r.id !== reservation.roomId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!roomId) return;
    setError(null);
    try {
      const updated = await action.mutateAsync({ kind: "change_room", roomId });
      toast(`${reservation.code} moved to room ${updated.roomNumber}`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title="Change room"
      description={`Other free ${reservation.roomTypeName} rooms for ${formatStay(reservation.arrival, reservation.departure)}.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="room-form" disabled={!roomId || action.isPending}>
            Move booking
          </Button>
        </>
      }
    >
      <form id="room-form" onSubmit={submit} className="flex flex-col gap-4">
        {free.isLoading ? (
          <p className="m-0 text-small text-muted">Finding free rooms…</p>
        ) : options.length === 0 ? (
          <p className="m-0 text-small text-muted">
            No other {reservation.roomTypeName} is free for these nights.
          </p>
        ) : (
          <SelectField label="New room" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">Choose a room</option>
            {options.map((r) => (
              <option key={r.id} value={r.id}>
                Room {r.number}
              </option>
            ))}
          </SelectField>
        )}
        <FormError message={error} />
      </form>
    </Dialog>
  );
}

export function ChangeDatesDialog({
  reservation,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const action = useReservationAction(reservation.id);
  const toast = useToast();
  const [arrival, setArrival] = useState(reservation.arrival);
  const [departure, setDeparture] = useState(reservation.departure);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (departure <= arrival) {
      setError("Departure must be after arrival.");
      return;
    }
    try {
      const updated = await action.mutateAsync({ kind: "change_dates", arrival, departure });
      toast(`New total ${formatEgp(updated.total)} · room ${updated.roomNumber}`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title="Change dates"
      description="The stay is re-priced for the new nights. The room is kept if it's free, otherwise another room of the same type is assigned."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="dates-form" disabled={action.isPending}>
            Save dates
          </Button>
        </>
      }
    >
      <form id="dates-form" onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Check-in"
            type="date"
            required
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
          />
          <InputField
            label="Check-out"
            type="date"
            required
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          />
        </div>
        <FormError message={error} />
      </form>
    </Dialog>
  );
}

/** Extend an in-house stay: the server claims the extra nights on the same room and prices them. */
export function ExtendStayDialog({
  reservation,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const extend = useExtendStay();
  const toast = useToast();
  const [departure, setDeparture] = useState(addIsoDays(reservation.departure, 1));
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const updated = await extend.mutateAsync({ id: reservation.id, departure });
      toast(
        `Stay extended to ${formatIsoDate(updated.departure)} · new total ${formatEgp(updated.total)}`,
      );
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title="Extend stay"
      description={`Currently leaving ${formatIsoDate(reservation.departure, true)}. The extra nights are priced and added to the folio.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="extend-form" disabled={extend.isPending}>
            Extend
          </Button>
        </>
      }
    >
      <form id="extend-form" onSubmit={submit} className="flex flex-col gap-4">
        <InputField
          label="New check-out"
          type="date"
          min={addIsoDays(reservation.departure, 1)}
          required
          value={departure}
          onChange={(e) => setDeparture(e.target.value)}
        />
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
