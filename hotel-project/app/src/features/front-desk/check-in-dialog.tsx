import { useState } from "react";
import { useCheckIn } from "@/api/front-desk";
import { useFreeRooms, type Reservation } from "@/api/reservations";
import { useRooms } from "@/api/rooms";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, SelectField } from "@/components/ui/fields";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { formatStay } from "@/lib/format";

const READY = new Set(["clean", "inspected"]);

/**
 * Check-in (a design gap, in the design's dialog language). Shows whether the assigned room is
 * ready; if it isn't, offers the ready rooms of the same type. The server re-checks everything.
 */
export function CheckInDialog({
  reservation,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const checkIn = useCheckIn();
  const toast = useToast();
  const rooms = useRooms();
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

  const byId = new Map((rooms.data ?? []).map((r) => [r.id, r]));
  const assigned = reservation.roomId ? byId.get(reservation.roomId) : undefined;
  const assignedReady = assigned
    ? READY.has(assigned.housekeepingStatus) &&
      assigned.serviceStatus === "in_service" &&
      assigned.displayStatus !== "occupied"
    : false;
  const readyAlternatives = (free.data ?? []).filter((r) => {
    const room = byId.get(r.id);
    return room && READY.has(room.housekeepingStatus) && room.serviceStatus === "in_service";
  });

  async function submit() {
    setError(null);
    try {
      const done = await checkIn.mutateAsync({ id: reservation.id, roomId: roomId || null });
      toast(`Guest checked in — Room ${done.roomNumber} marked Occupied`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title={`Check in ${reservation.guestName}`}
      description={`${reservation.code} · ${formatStay(reservation.arrival, reservation.departure)} · ${reservation.nights} night${reservation.nights === 1 ? "" : "s"}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void submit()}
            disabled={checkIn.isPending || (!assignedReady && !roomId)}
          >
            {checkIn.isPending ? "Checking in…" : "Check in"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-inner border border-border-subtle p-3.5">
          <div>
            <div className="text-body font-bold">Room {reservation.roomNumber ?? "—"}</div>
            <div className="text-label text-muted">{reservation.roomTypeName}</div>
          </div>
          {assigned ? (
            <StatusBadge
              status={assignedReady ? "available" : assigned.displayStatus}
              label={assignedReady ? "Ready" : undefined}
            />
          ) : null}
        </div>
        {!assignedReady ? (
          readyAlternatives.length > 0 ? (
            <SelectField
              label="Move to a ready room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">Choose a room</option>
              {readyAlternatives.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.number}
                </option>
              ))}
            </SelectField>
          ) : (
            <p className="m-0 text-small text-muted">
              No other {reservation.roomTypeName} is ready. Ask housekeeping to turn Room{" "}
              {reservation.roomNumber}.
            </p>
          )
        ) : null}
        <FormError message={error} />
      </div>
    </Dialog>
  );
}
