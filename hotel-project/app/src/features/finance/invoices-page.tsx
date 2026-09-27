import { useState } from "react";
import { Link } from "react-router-dom";
import { useInvoices } from "@/api/billing";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate, formatEgp } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { FinanceTabs } from "./finance-tabs";

type Filter = "all" | "issued" | "void";
const COLS = "md:grid-cols-[110px_1.4fr_100px_120px_130px_90px]";

/** Invoices (a design gap): every invoice issued at check-out, including voided ones. */
export function InvoicesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim());
  const invoices = useInvoices({
    status: filter === "all" ? undefined : filter,
    q: q || undefined,
  });

  return (
    <>
      <PageHeader title="Invoices" subtitle="Issued at check-out; void ones stay on record." />
      <FinanceTabs />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FilterTabs
          label="Invoice status"
          value={filter}
          onChange={setFilter}
          tabs={[
            { value: "all", label: "All" },
            { value: "issued", label: "Issued" },
            { value: "void", label: "Void" },
          ]}
        />
        <input
          type="search"
          aria-label="Search invoices"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Invoice number, guest or booking…"
          className="w-full max-w-[320px] rounded-button border border-border bg-surface px-3.5 py-2 text-small outline-none placeholder:text-faint focus:border-primary"
        />
      </div>
      {invoices.isLoading ? (
        <LoadingState />
      ) : invoices.error ? (
        <ErrorState error={invoices.error} />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div
            className={`hidden border-b border-border bg-canvas px-4 py-3 text-micro font-bold text-faint uppercase md:grid ${COLS}`}
          >
            <div>Invoice</div>
            <div>Billed to</div>
            <div>Booking</div>
            <div>Issued</div>
            <div>Total</div>
            <div>Status</div>
          </div>
          {invoices.data!.length === 0 ? (
            <div className="px-5 py-12 text-center text-small text-faint">No invoices match.</div>
          ) : (
            <ul className="m-0 list-none p-0">
              {invoices.data!.map((i) => (
                <li key={i.id} className="border-b border-divider last:border-b-0">
                  <Link
                    to={`/invoices/${i.id}`}
                    className={`grid grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-[13px] hover:bg-canvas ${COLS}`}
                  >
                    <div className="font-mono text-label font-bold">{i.number}</div>
                    <div className="truncate text-small font-semibold">{i.billToName}</div>
                    <div className="font-mono text-label text-faint">{i.reservationCode}</div>
                    <div className="text-label text-muted">{formatDate(i.issuedAt)}</div>
                    <div className="text-small font-semibold">{formatEgp(i.total)}</div>
                    <StatusBadge
                      status={i.status === "void" ? "cancelled" : "paid"}
                      label={i.status === "void" ? "Void" : "Issued"}
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
