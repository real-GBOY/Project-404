import { useState, type FormEvent } from "react";
import { useArchiveRoom, useSaveRoom, type Room, type RoomType } from "@/api/rooms";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, InputField, SelectField, TextAreaField } from "@/components/ui/fields";
import { errorMessage } from "@/lib/errors";
import { useToast } from "@/components/ui/toast";

/** Add or edit a room. Housekeeping/service status are NOT editable here — they change only
 *  through housekeeping and maintenance workflows. */
export function RoomDialog({
  room,
  types,
  onClose,
}: {
  room?: Room;
  types: RoomType[];
  onClose: () => void;
}) {
  const save = useSaveRoom();
  const archive = useArchiveRoom();
  const toast = useToast();
  const [number, setNumber] = useState(room?.number ?? "");
  const [floor, setFloor] = useState(room ? String(room.floor) : "");
  const [roomTypeId, setRoomTypeId] = useState(room?.roomTypeId ?? types[0]?.id ?? "");
  const [notes, setNotes] = useState(room?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: room?.id,
        input: {
          number: number.trim(),
          floor: Number(floor),
          roomTypeId,
          notes: notes.trim() || null,
        },
      });
      toast(room ? `Room ${number} updated` : `Room ${number} added`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function doArchive() {
    if (!room) return;
    setError(null);
    try {
      await archive.mutateAsync(room.id);
      toast(`Room ${room.number} archived`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title={room ? `Room ${room.number}` : "Add room"}
      description={
        room ? "Edit the room's number, floor or type." : "A new room starts clean and in service."
      }
      onClose={onClose}
      footer={
        <>
          {room ? (
            <Button
              variant="secondary"
              size="sm"
              className="mr-auto"
              onClick={doArchive}
              disabled={archive.isPending}
            >
              Archive room
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="room-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="room-form" onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="Room number"
            required
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <InputField
            label="Floor"
            type="number"
            required
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
          />
        </div>
        <SelectField
          label="Room type"
          required
          value={roomTypeId}
          onChange={(e) => setRoomTypeId(e.target.value)}
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
        <TextAreaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
