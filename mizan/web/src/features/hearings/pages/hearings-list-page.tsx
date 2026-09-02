import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { EmptyState } from "@/components/feedback/empty-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { useHearingList } from "../hooks/use-hearings";
import { AdjournDialog, OutcomeDialog, ScheduleHearingDialog } from "../components/hearing-dialogs";
import type { HearingRow } from "../api/hearings.api";

function StatusBadge({ status }: { status: HearingRow["status"] }) {
  const { t } = useTranslation("hearings");
  const tone = status === "scheduled" ? "info" : status === "decided" ? "success" : "neutral";
  return (
    <Badge tone={tone} size="sm">
      {t(`status.${status}`)}
    </Badge>
  );
}

export function HearingsListPage({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation("hearings");
  const { can } = usePermissions();
  const params = useUrlParams<"scope">({ scope: "upcoming" });
  const scope = (params.get("scope") as "upcoming" | "past") ?? "upcoming";
  const query = useHearingList({ scope });
  const [scheduling, setScheduling] = useState(false);
  const [adjourning, setAdjourning] = useState<HearingRow | null>(null);
  const [recording, setRecording] = useState<HearingRow | null>(null);
  const canManage = can("update:hearing");

  const body = (
    <>
      <div className="flex items-center justify-between">
        <SegmentedControl
          aria-label={t("scope.label")}
          value={scope}
          onValueChange={(v) => params.set({ scope: v === "upcoming" ? undefined : v })}
          options={[
            { value: "upcoming", label: t("scope.upcoming") },
            { value: "past", label: t("scope.past") },
          ]}
        />
        {!embedded && can("create:hearing") && (
          <Button icon="add" onClick={() => setScheduling(true)}>
            {t("actions.schedule")}
          </Button>
        )}
      </div>

      <QueryBoundary
        query={query}
        loading={<RowsSkeleton rows={6} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon="event"
            title={scope === "upcoming" ? t("empty.upcoming") : t("empty.past")}
            action={
              scope === "upcoming" && can("create:hearing") ? (
                <Button icon="add" onClick={() => setScheduling(true)}>
                  {t("actions.schedule")}
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(data) => (
          <div className="divide-y divide-divider rounded-lg border border-border bg-surface">
            {data.items.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex w-12 flex-none flex-col items-center rounded-md bg-surface-sand py-1 text-link">
                  <span className="text-[15px] font-extrabold leading-none">
                    {formatDate(h.scheduledAt, { day: "2-digit" })}
                  </span>
                  <span className="text-[9px] font-bold uppercase">
                    {formatDate(h.scheduledAt, { month: "short" })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/matters/${h.matterId}?tab=hearings`}
                      className="truncate text-[12.5px] font-semibold text-foreground hover:underline"
                    >
                      {h.matterTitle}
                    </Link>
                    <StatusBadge status={h.status} />
                  </div>
                  <div className="truncate text-[11.5px] text-muted">
                    {h.purpose} · {h.court} ·{" "}
                    {formatDate(h.scheduledAt, { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {h.outcome && <div className="mt-0.5 text-[11.5px] text-foreground-body">“{h.outcome}”</div>}
                </div>
                {canManage && h.status === "scheduled" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={t("common:actions.edit")}
                      className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-subtle"
                    >
                      <Icon name="more_horiz" size={17} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem icon="event_repeat" onSelect={() => setAdjourning(h)}>
                        {t("actions.adjourn")}
                      </DropdownMenuItem>
                      <DropdownMenuItem icon="gavel" onSelect={() => setRecording(h)}>
                        {t("actions.record_outcome")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        )}
      </QueryBoundary>

      <ScheduleHearingDialog open={scheduling} onOpenChange={setScheduling} />
      <AdjournDialog hearing={adjourning} onOpenChange={(o) => !o && setAdjourning(null)} />
      <OutcomeDialog hearing={recording} onOpenChange={(o) => !o && setRecording(null)} />
    </>
  );

  if (embedded) return <div className="flex flex-col gap-4">{body}</div>;

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          can("create:hearing") ? (
            <Button icon="add" onClick={() => setScheduling(true)}>
              {t("actions.schedule")}
            </Button>
          ) : undefined
        }
      />
      {body}
    </PageContainer>
  );
}
