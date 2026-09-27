import { useMemo, useState } from "react";
import {
  useRooms,
  useRoomTypes,
  type Room,
  type RoomDisplayStatus,
  type RoomType,
} from "@/api/rooms";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { FilterTabs, type FilterTab } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatEgp } from "@/lib/format";
import { RoomDialog } from "./room-dialog";
import { RoomTypeDialog } from "./room-type-dialog";

type Filter = "all" | RoomDisplayStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "occupied", label: "Occupied" },
  { value: "dirty", label: "Dirty" },
  { value: "cleaning", label: "Cleaning" },
  { value: "maintenance", label: "Maintenance" },
  { value: "out_of_service", label: "Out of Service" },
];

/**
 * Rooms board (design: "Rooms"): status filter pills, a grid of room cards showing the DERIVED
 * status, and the room types below. Managers can add and edit rooms and types.
 */
export function RoomsPage() {
  const auth = useAuth();
  const canManage = auth.can("manage:room");
  const rooms = useRooms();
  const types = useRoomTypes();
  const [filter, setFilter] = useState<Filter>("all");
  const [roomDialog, setRoomDialog] = useState<{ room?: Room } | null>(null);
  const [typeDialog, setTypeDialog] = useState<{ type?: RoomType } | null>(null);

  const tabs = useMemo<Array<FilterTab<Filter>>>(() => {
    const list = rooms.data ?? [];
    return FILTERS.map((f) => ({
      ...f,
      count:
        f.value === "all" ? list.length : list.filter((r) => r.displayStatus === f.value).length,
    }));
  }, [rooms.data]);

  const visible = (rooms.data ?? []).filter((r) => filter === "all" || r.displayStatus === filter);

  return (
    <>
      <PageHeader
        title="Rooms"
        actions={
          canManage ? (
            <>
              <Button variant="secondary" onClick={() => setTypeDialog({})}>
                + Room type
              </Button>
              <Button onClick={() => setRoomDialog({})} disabled={!types.data?.length}>
                + Add room
              </Button>
            </>
          ) : null
        }
      />

      {rooms.isLoading ? (
        <LoadingState />
      ) : rooms.error ? (
        <ErrorState error={rooms.error} />
      ) : (
        <>
          <div className="mb-5">
            <FilterTabs
              label="Filter rooms by status"
              tabs={tabs}
              value={filter}
              onChange={setFilter}
            />
          </div>
          {visible.length === 0 ? (
            <EmptyState title={rooms.data?.length ? "No rooms in this status" : "No rooms yet"}>
              {!rooms.data?.length && canManage ? "Add a room type, then your rooms." : null}
            </EmptyState>
          ) : (
            <ul className="m-0 mb-7 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visible.map((room) => (
                <li key={room.id}>
                  <RoomCard
                    room={room}
                    onEdit={canManage ? () => setRoomDialog({ room }) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <h2 className="m-0 mb-3.5 text-[16px] font-extrabold">Room Types</h2>
      {types.isLoading ? (
        <LoadingState />
      ) : types.error ? (
        <ErrorState error={types.error} />
      ) : (types.data ?? []).length === 0 ? (
        <EmptyState title="No room types yet" />
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {types.data!.map((t) => (
            <li key={t.id} className="rounded-card border border-border bg-surface p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="text-body font-bold">{t.name}</div>
                <span className="font-mono text-micro text-faint">{t.code}</span>
              </div>
              <div className="mt-1 mb-2 text-label text-muted">
                {t.beds} · {t.capacity} guests · {t.roomCount} rooms
              </div>
              <div className="text-title font-extrabold">
                {formatEgp(t.baseRate)}
                <span className="text-micro font-medium text-faint">/night</span>
              </div>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setTypeDialog({ type: t })}
                  className="mt-2 cursor-pointer text-label font-semibold text-primary hover:text-primary-strong"
                >
                  Edit type
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {roomDialog ? (
        <RoomDialog
          room={roomDialog.room}
          types={types.data ?? []}
          onClose={() => setRoomDialog(null)}
        />
      ) : null}
      {typeDialog ? (
        <RoomTypeDialog type={typeDialog.type} onClose={() => setTypeDialog(null)} />
      ) : null}
    </>
  );
}

function RoomCard({ room, onEdit }: { room: Room; onEdit?: () => void }) {
  const body = (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[16px] font-extrabold">{room.number}</div>
        <StatusBadge status={room.displayStatus} size="sm" />
      </div>
      <div className="text-label text-muted">
        {room.roomTypeName} · Floor {room.floor}
      </div>
    </>
  );
  const cls = "block h-full w-full rounded-[11px] border border-border bg-surface p-3.5 text-left";
  return onEdit ? (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Room ${room.number}, ${room.displayStatus.replace(/_/g, " ")}`}
      className={`${cls} cursor-pointer hover:border-primary`}
    >
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
