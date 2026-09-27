import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useReservations, type ReservationStatus } from "@/api/reservations";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatEgp, formatStay } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type Filter = "all" | ReservationStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked In" },
  { value: "checked_out", label: "Checked Out" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No Show" },
];

const PAGE_SIZE = 25;
const COLS = "md:grid-cols-[100px_1.2fr_70px_1.4fr_60px_110px_110px]";

/** Reservations (design: "Reservations"): status pills, search, and the bookings table. */
export function ReservationsPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(query.trim());
  const list = useReservations({
    status: filter === "all" ? undefined : filter,
    q,
    page,
    pageSize: PAGE_SIZE,
  });
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Reservations"
        actions={
          auth.can("create:reservation") ? (
            <Button onClick={() => navigate("/reservations/new")}>+ New Reservation</Button>
          ) : null
        }
      />
      <div className="mb-4">
        <FilterTabs
          label="Filter reservations by status"
          tabs={FILTERS}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
        />
      </div>
      <input
        type="search"
        aria-label="Search reservations"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        placeholder="Search by guest, booking ID or room…"
        className="mb-[18px] w-full max-w-[420px] rounded-button border border-border bg-surface px-3.5 py-2.5 text-body outline-none placeholder:text-faint focus:border-primary"
      />

      {list.isLoading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState error={list.error} />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div
            className={`hidden border-b border-border bg-canvas px-4 py-3 text-micro font-bold tracking-[0.03em] text-faint uppercase md:grid ${COLS}`}
          >
            <div>Booking</div>
            <div>Guest</div>
            <div>Room</div>
            <div>Dates</div>
            <div>Guests</div>
            <div>Amount</div>
            <div>Status</div>
          </div>
          {list.data!.items.length === 0 ? (
            <div className="px-5 py-15 text-center text-faint">
              <div className="mb-1 text-body font-semibold">No reservations match your filters</div>
              <div className="text-small">
                Try clearing the search or selecting a different status.
              </div>
            </div>
          ) : (
            <ul className="m-0 list-none p-0">
              {list.data!.items.map((r) => (
                <li key={r.id} className="border-b border-divider last:border-b-0">
                  <Link
                    to={`/reservations/${r.id}`}
                    className={`grid grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-3.5 hover:bg-canvas ${COLS}`}
                  >
                    <div className="font-mono text-label text-muted">{r.code}</div>
                    <div className="text-small font-semibold">{r.guestName}</div>
                    <div className="text-small">{r.roomNumber ?? "—"}</div>
                    <div className="text-label text-muted">
                      {formatStay(r.arrival, r.departure)}
                    </div>
                    <div className="text-small">{r.adults + r.children}</div>
                    <div className="text-small font-semibold">{formatEgp(r.total)}</div>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {pages > 1 ? (
        <nav
          aria-label="Reservation pages"
          className="mt-5 flex items-center justify-center gap-3 text-small"
        >
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-muted">
            Page {page} of {pages} · {total} reservations
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </>
  );
}
