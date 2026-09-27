import { useState } from "react";
import { Link } from "react-router-dom";
import { METHOD_LABEL, useFinanceSummary, useLedger, type PaymentMethod } from "@/api/billing";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatEgp, formatIsoDate } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/cn";
import { FinanceTabs } from "./finance-tabs";

type Kind = "all" | "payment" | "refund";
const COLS = "md:grid-cols-[120px_1.3fr_100px_120px_130px_100px]";

/**
 * Payments (design: "Payments"): the design's four summary cards and the payments table, with
 * refunds shown in the same ledger as money going out. Every figure comes from payment and refund
 * rows — nothing here is a stored total.
 */
export function PaymentsPage() {
  const summary = useFinanceSummary();
  const [kind, setKind] = useState<Kind>("all");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim());
  const ledger = useLedger({
    kind: kind === "all" ? undefined : kind,
    method: method || undefined,
    q: q || undefined,
  });

  const s = summary.data;
  const cards = s
    ? [
        { label: "Today's Payments", value: formatEgp(s.today.collected) },
        { label: "Collected this month", value: formatEgp(s.month.net), sub: "net of refunds" },
        { label: "Outstanding", value: formatEgp(s.outstanding), tone: "text-danger" },
        {
          label: "Refunds this month",
          value: formatEgp(s.month.refunded),
          sub: s.credits > 0 ? `${formatEgp(s.credits)} still owed back` : undefined,
        },
      ]
    : [];

  return (
    <>
      <PageHeader title="Payments" subtitle="Money in, money out, and what is still open." />
      <FinanceTabs />
      {summary.error ? <ErrorState error={summary.error} /> : null}
      <div className="mb-[22px] grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            aria-label={c.label}
            className="rounded-card border border-border bg-surface p-4"
          >
            <div className="mb-2 text-label text-muted">{c.label}</div>
            <div className={cn("text-[20px] font-extrabold", c.tone)}>{c.value}</div>
            {c.sub ? <div className="mt-1 text-label text-faint">{c.sub}</div> : null}
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs
          label="Payments or refunds"
          value={kind}
          onChange={setKind}
          tabs={[
            { value: "all", label: "All" },
            { value: "payment", label: "Payments" },
            { value: "refund", label: "Refunds" },
          ]}
        />
        <select
          aria-label="Method"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod | "")}
          className="cursor-pointer rounded-control border border-border bg-surface px-3 py-2 text-small"
        >
          <option value="">All methods</option>
          {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>
              {METHOD_LABEL[m]}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Search payments"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Guest, booking or payment ID…"
          className="w-full max-w-[320px] rounded-button border border-border bg-surface px-3.5 py-2 text-small outline-none placeholder:text-faint focus:border-primary"
        />
      </div>

      {ledger.isLoading ? (
        <LoadingState />
      ) : ledger.error ? (
        <ErrorState error={ledger.error} />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div
            className={`hidden border-b border-border bg-canvas px-4 py-3 text-micro font-bold text-faint uppercase md:grid ${COLS}`}
          >
            <div>Payment</div>
            <div>Guest</div>
            <div>Booking</div>
            <div>Method</div>
            <div>Amount</div>
            <div>Status</div>
          </div>
          {ledger.data!.length === 0 ? (
            <div className="px-5 py-12 text-center text-small text-faint">No payments match.</div>
          ) : (
            <ul className="m-0 list-none p-0">
              {ledger.data!.map((e) => (
                <li key={e.id} className="border-b border-divider last:border-b-0">
                  <Link
                    to={`/reservations/${e.reservationId}`}
                    className={`grid grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-[13px] hover:bg-canvas ${COLS}`}
                  >
                    <div className="truncate font-mono text-label text-muted" title={e.id}>
                      {e.kind === "refund" ? "Refund" : e.id.slice(0, 12)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-small font-semibold">{e.guestName}</div>
                      <div className="text-label text-faint">
                        {e.actorName ?? "—"} · {formatIsoDate(e.businessDate)}
                      </div>
                    </div>
                    <div className="font-mono text-label text-faint">{e.reservationCode}</div>
                    <div className="text-small">{METHOD_LABEL[e.method]}</div>
                    <div
                      className={cn(
                        "text-small font-semibold",
                        e.kind === "refund" && "text-warning-strong",
                      )}
                    >
                      {e.kind === "refund" ? "−" : ""}
                      {formatEgp(e.amount)}
                    </div>
                    <StatusBadge
                      status={
                        e.kind === "refund" && e.status === "completed" ? "refunded" : e.status
                      }
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
