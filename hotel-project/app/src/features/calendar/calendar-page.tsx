import { useState } from "react";
import { Link } from "react-router-dom";
import { useCalendar, type CalendarBar } from "@/api/reservations";
import { useRoomTypes } from "@/api/rooms";
import { Button } from "@/components/ui/button";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import {
  addIsoDays,
  formatDayHeader,
  formatIsoDate,
  hotelToday,
  isoDaysBetween,
} from "@/lib/format";
import { statusLabel, toneFor, type Tone } from "@/lib/status";

const BAR_TONE: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-strong",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  primary: "bg-primary text-white",
  neutral: "bg-neutral-soft text-neutral",
};

/**
 * Booking calendar (design: "Calendar"): rooms × days with each stay drawn as a bar from mid-day
 * of arrival to mid-day of departure — so a same-day turnover shows two half-bars side by side,
 * never overlapping. Everything shown is read from the allocation ledger; nothing here mutates.
 */
export function CalendarPage() {
  const today = hotelToday();
  const [from, setFrom] = useState(today);
  const [days, setDays] = useState<7 | 14>(7);
  const [typeId, setTypeId] = useState("all");
  const calendar = useCalendar({ from, days });
  const types = useRoomTypes();

  const rooms = (calendar.data?.rooms ?? []).filter(
    (r) => typeId === "all" || r.roomTypeId === typeId,
  );
  const to = addIsoDays(from, days);

  return (
    <>
      <PageHeader
        title="Booking Calendar"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFrom(today)}
              disabled={from === today}
            >
              Today
            </Button>
            <button
              type="button"
              aria-label="Previous period"
              onClick={() => setFrom(addIsoDays(from, -days))}
              className="size-[34px] cursor-pointer rounded-control border border-border bg-surface font-bold"
            >
              ‹
            </button>
            <div className="min-w-[150px] text-center text-small font-semibold">
              {formatIsoDate(from)} – {formatIsoDate(addIsoDays(to, -1), true)}
            </div>
            <button
              type="button"
              aria-label="Next period"
              onClick={() => setFrom(addIsoDays(from, days))}
              className="size-[34px] cursor-pointer rounded-control border border-border bg-surface font-bold"
            >
              ›
            </button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs
          label="Days shown"
          size="sm"
          value={String(days) as "7" | "14"}
          onChange={(v) => setDays(Number(v) as 7 | 14)}
          tabs={[
            { value: "7", label: "7 days" },
            { value: "14", label: "14 days" },
          ]}
        />
        <select
          aria-label="Room type"
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          className="cursor-pointer rounded-control border border-border bg-surface px-3 py-[7px] text-small"
        >
          <option value="all">All room types</option>
          {(types.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {calendar.isLoading ? (
        <LoadingState />
      ) : calendar.error ? (
        <ErrorState error={calendar.error} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <div style={{ minWidth: days === 7 ? 760 : 1180 }}>
            <div
              className="grid border-b border-border"
              style={{ gridTemplateColumns: `110px repeat(${days}, 1fr)` }}
            >
              <div className="bg-canvas px-3.5 py-2.5 text-micro font-bold text-faint uppercase">
                Room
              </div>
              {calendar.data!.days.map((d) => (
                <div
                  key={d}
                  className={cn(
                    "border-l border-border-subtle bg-canvas px-2 py-2.5 text-center text-label font-bold",
                    d === today && "text-primary",
                  )}
                >
                  {formatDayHeader(d)}
                </div>
              ))}
            </div>
            <ul className="m-0 list-none p-0" aria-label="Rooms">
              {rooms.map((room) => (
                <li
                  key={room.id}
                  className="relative grid h-11 border-b border-divider last:border-b-0"
                  style={{ gridTemplateColumns: `110px repeat(${days}, 1fr)` }}
                >
                  <div className="flex items-center px-3.5 text-label font-bold">
                    {room.number}
                    <span className="ml-1.5 text-micro font-medium text-faint">
                      {room.roomTypeCode}
                    </span>
                  </div>
                  <div className="relative" style={{ gridColumn: `2 / span ${days}` }}>
                    <div
                      className="absolute inset-0 grid"
                      style={{ gridTemplateColumns: `repeat(${days}, 1fr)` }}
                    >
                      {calendar.data!.days.map((d) => (
                        <div
                          key={d}
                          className={cn(
                            "border-l border-divider",
                            d === today && "bg-primary-soft/40",
                          )}
                        />
                      ))}
                    </div>
                    {room.bars.map((bar, i) => (
                      <Bar key={i} bar={bar} from={from} days={days} roomNumber={room.number} />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

function Bar({
  bar,
  from,
  days,
  roomNumber,
}: {
  bar: CalendarBar;
  from: string;
  days: number;
  roomNumber: string;
}) {
  // Stays run from mid-day of arrival to mid-day of departure; clamp to the visible window.
  const start = Math.max(isoDaysBetween(from, bar.start) + 0.5, 0);
  const end = Math.min(isoDaysBetween(from, bar.end) + 0.5, days);
  if (end <= start) return null;
  const style = {
    left: `calc(${(start / days) * 100}% + 2px)`,
    width: `calc(${((end - start) / days) * 100}% - 4px)`,
  };
  const tone = bar.kind === "block" ? "neutral" : toneFor(bar.status ?? "confirmed");
  const cls = cn(
    "absolute top-1.5 bottom-1.5 flex items-center overflow-hidden rounded-badge px-2 text-micro font-bold whitespace-nowrap",
    BAR_TONE[tone],
  );
  const label =
    bar.kind === "block"
      ? `Blocked${bar.reason ? ` · ${bar.reason}` : ""}`
      : `${bar.guestName} · ${bar.code}`;
  const title = `Room ${roomNumber}: ${label} (${formatIsoDate(bar.start)} → ${formatIsoDate(bar.end)}${
    bar.status ? `, ${statusLabel(bar.status)}` : ""
  })`;
  return bar.reservationId ? (
    <Link
      to={`/reservations/${bar.reservationId}`}
      className={cls}
      style={style}
      title={title}
      aria-label={title}
    >
      {label}
    </Link>
  ) : (
    <div className={cls} style={style} title={title}>
      {label}
    </div>
  );
}
