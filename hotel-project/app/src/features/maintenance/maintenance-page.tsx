import { useState } from "react";
import { Link } from "react-router-dom";
import { useTickets } from "@/api/operations";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { formatIsoDate, statusLabelOrDash } from "./labels";
import { ReportIssueDialog } from "./report-issue-dialog";

type Scope = "open" | "mine" | "all";

/**
 * Maintenance (design: "Maintenance"): ticket rows with number, issue, room · assignee, and
 * priority + status pills. "Report Issue" opens the report dialog (a design gap filled in the
 * design's language). A ticket that takes its room out of sale says until when.
 */
export function MaintenancePage() {
  const auth = useAuth();
  const [scope, setScope] = useState<Scope>("open");
  const tickets = useTickets({ open: scope === "open", mine: scope === "mine" });
  const [reporting, setReporting] = useState(false);

  return (
    <>
      <PageHeader
        title="Maintenance"
        subtitle="Room issues, repairs and rooms out of sale."
        actions={
          auth.can("create:maintenance") ? (
            <Button onClick={() => setReporting(true)}>+ Report Issue</Button>
          ) : undefined
        }
      />
      <div className="mb-4">
        <FilterTabs
          label="Tickets"
          value={scope}
          onChange={setScope}
          tabs={[
            { value: "open", label: "Open" },
            ...(auth.can("update:maintenance") ? [{ value: "mine" as const, label: "Mine" }] : []),
            { value: "all", label: "All" },
          ]}
        />
      </div>
      {tickets.isLoading ? (
        <LoadingState />
      ) : tickets.error ? (
        <ErrorState error={tickets.error} />
      ) : tickets.data!.length === 0 ? (
        <EmptyState title="No tickets here.">Everything is working.</EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {tickets.data!.map((t) => (
            <li key={t.id}>
              <Link
                to={`/maintenance/${t.id}`}
                className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-4 hover:border-rule sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="shrink-0 font-mono text-label text-faint">{t.number}</div>
                  <div className="min-w-0">
                    <div className="truncate text-body font-bold">{t.title}</div>
                    <div className="mt-0.5 text-label text-muted">
                      Room {t.roomNumber} · {t.assigneeName ?? "Unassigned"}
                      {t.roomImpact !== "none" && t.status !== "verified" && t.expectedBack
                        ? ` · ${statusLabelOrDash(t.roomImpact)} until ${formatIsoDate(t.expectedBack)}`
                        : ""}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <StatusBadge status={t.priority} />
                  <StatusBadge status={t.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {reporting ? <ReportIssueDialog onClose={() => setReporting(false)} /> : null}
    </>
  );
}
