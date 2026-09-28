import { useState, type FormEvent } from "react";
import { useSaveRoomType, type RoomType } from "@/api/rooms";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, InputField, TextAreaField } from "@/components/ui/fields";
import { errorMessage } from "@/lib/errors";
import { useToast } from "@/components/ui/toast";

/** Add or edit a room type — the sellable category and its base nightly rate (EGP). */
export function RoomTypeDialog({ type, onClose }: { type?: RoomType; onClose: () => void }) {
  const save = useSaveRoomType();
  const toast = useToast();
  const [code, setCode] = useState(type?.code ?? "");
  const [name, setName] = useState(type?.name ?? "");
  const [capacity, setCapacity] = useState(type ? String(type.capacity) : "2");
  const [beds, setBeds] = useState(type?.beds ?? "");
  const [baseRate, setBaseRate] = useState(type ? String(type.baseRate) : "");
  const [amenities, setAmenities] = useState(type?.amenities.join(", ") ?? "");
  const [description, setDescription] = useState(type?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        id: type?.id,
        input: {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          capacity: Number(capacity),
          beds: beds.trim(),
          baseRate: Number(baseRate),
          amenities: amenities
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean),
          description: description.trim() || null,
        },
      });
      toast(type ? `${name} updated` : `${name} added`);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Dialog
      open
      title={type ? `Edit ${type.name}` : "New room type"}
      onClose={onClose}
      width={540}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" type="submit" form="room-type-form" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="room-type-form" onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-[120px_1fr] gap-4">
          <InputField
            label="Code"
            required
            disabled={Boolean(type)}
            hint={type ? "Fixed once created" : "e.g. DLX"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <InputField
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <InputField
            label="Guests"
            type="number"
            min={1}
            max={12}
            required
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <InputField
            label="Beds"
            required
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
          />
          <InputField
            label="Base rate (EGP)"
            type="number"
            min={1}
            step="0.01"
            required
            value={baseRate}
            onChange={(e) => setBaseRate(e.target.value)}
          />
        </div>
        <InputField
          label="Amenities"
          hint="Comma-separated"
          value={amenities}
          onChange={(e) => setAmenities(e.target.value)}
        />
        <TextAreaField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <FormError message={error} />
      </form>
    </Dialog>
  );
}
