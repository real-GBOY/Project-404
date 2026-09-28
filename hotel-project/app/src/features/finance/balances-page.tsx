import { useState } from "react";
import { Link } from "react-router-dom";
import { useBalances } from "@/api/billing";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatEgp, formatStay } from "@/lib/format";
import { cn } from "@/lib/cn";
import { FinanceTabs } from "./finance-tabs";

type Filter = "due" | "credit";
const COLS = "md:grid-cols-[100px_1.3fr_70px_1.2fr_110px_120px_120px]";

/**
 * Outstanding balances (a design gap): every folio that isn't square — money still owed by
 * guests, and money owed back to them (cancelled deposits, failed refunds). Opening a row goes
 * to the booking, where payment or refund happens.
 */
export function BalancesPage() {
  const balances = useBalances();
  const [filter, setFilter] = useState<Filter>("due");
  const rows = (balances.data ?? []).filter((b) => b.kind === filter);
  const count = (k: Filter) => (balances.data ?? []).filter((b) => b.kind === k).length;
  const sum = rows.reduce((s, b) => s + Math.abs(b.balance), 0);

  return (
    <>
      <PageHeader title="Balances" subtitle="Folios that aren't settled yet." />
      <FinanceTabs />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          label="Owed by or to guests"
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: "due", label: "Owed by guests", count: count("due") },
            { value: "credit", label: "Owed to guests", count: count("credit") },
          ]}
        />
        {rows.length > 0 ? (
          <div className="text-small font-bold">
            {filter === "due" ? "Outstanding" : "To refund"}: {formatEgp(sum)}
          </div>
        ) : null}
      </div>
      {balances.isLoading ? (
        <LoadingState />
      ) : balances.error ? (
        <ErrorState error={balances.error} />
      ) : rows.length === 0 ? (
        <EmptyState title={filter === "due" ? "Nobody owes anything." : "Nothing to refund."} />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div
            className={`hidden border-b border-border bg-canvas px-4 py-3 text-micro font-bold text-faint uppercase md:grid ${COLS}`}
          >
            <div>Booking</div>
            <div>Guest</div>
            <div>Room</div>
            <div>Stay</div>
            <div>Paid</div>
            <div>{filter === "due" ? "Balance due" : "Owed back"}</div>
            <div>Status</div>
          </div>
          <ul className="m-0 list-none p-0">
            {rows.map((b) => (
              <li key={b.reservationId} className="border-b border-divider last:border-b-0">
                <Link
                  to={`/reservations/${b.reservationId}`}
                  className={`grid grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-[13px] hover:bg-canvas ${COLS}`}
                >
                  <div className="font-mono text-label text-muted">{b.code}</div>
                  <div className="truncate text-small font-semibold">{b.guestName}</div>
                  <div className="text-small">{b.roomNumber ?? "—"}</div>
                  <div className="text-label text-muted">{formatStay(b.arrival, b.departure)}</div>
                  <div className="text-small">{formatEgp(b.paid)}</div>
                  <div
                    className={cn(
                      "text-small font-bold",
                      b.kind === "due" ? "text-danger" : "text-warning-strong",
                    )}
                  >
                    {formatEgp(Math.abs(b.balance))}
                  </div>
                  <StatusBadge status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
