import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { Skeleton } from "@/components/feedback/skeleton";
import { useMatter, useMatterMutations } from "../hooks/use-matters";
import { MatterFormDialog } from "../components/matter-form-dialog";
import { MatterStatusBadge } from "../components/matter-badges";
import {
  MatterActivityTab,
  MatterDocumentsTab,
  MatterFinancialsTab,
  MatterHearingsTab,
  MatterNotesTab,
  MatterParticipants,
  MatterTasksTab,
  MatterTimelineTab,
} from "../components/matter-tabs";

const TABS = ["overview", "hearings", "tasks", "documents", "notes", "financials", "activity"] as const;

export function MatterDetailPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation("matters");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const params = useUrlParams<"tab">({ tab: "overview" });
  const active = (TABS as readonly string[]).includes(params.get("tab") ?? "")
    ? (params.get("tab") as (typeof TABS)[number])
    : "overview";

  const query = useMatter(id);
  const { close } = useMatterMutations(id);
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const canWrite = can("update:matter");

  return (
    <PageContainer>
      <QueryBoundary
        query={query}
        loading={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-16" />
            <Skeleton className="h-64" />
          </div>
        }
      >
        {(matter) => (
          <>
            <Breadcrumb
              items={[
                { label: t("common:nav.matters"), to: "/matters" },
                { label: matter.reference },
              ]}
            />

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[19px] font-extrabold tracking-tight text-foreground">
                    {matter.title}
                  </h1>
                  <MatterStatusBadge status={matter.status} />
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted">
                  <span>{matter.reference}</span>
                  <span>·</span>
                  <Link to={`/clients/${matter.clientId}`} className="text-link hover:underline">
                    {matter.clientName}
                  </Link>
                  <span>·</span>
                  <span>{matter.practiceArea}</span>
                  {matter.court && (
                    <>
                      <span>·</span>
                      <span>{matter.court}</span>
                    </>
                  )}
                </p>
              </div>

              {canWrite && (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" icon="edit" onClick={() => setEditing(true)}>
                    {t("common:actions.edit")}
                  </Button>
                  {matter.status !== "closed" && can("close:matter") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={t("actions.more")}
                        className="flex size-9 items-center justify-center rounded-md border border-border-control text-foreground-body hover:bg-surface-subtle"
                      >
                        <Icon name="more_horiz" size={18} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem icon="lock" onSelect={() => setClosing(true)}>
                          {t("actions.close")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </div>

            <Tabs value={active} onValueChange={(v) => params.set({ tab: v })}>
              <TabsList className="overflow-x-auto">
                {TABS.map((name) => (
                  <TabsTrigger key={name} value={name}>
                    {t(`tabs.${name}`)}
                    {name === "tasks" && matter.counts.openTasks > 0 && (
                      <span className="ms-1 rounded-pill bg-surface-subtle px-1 text-[10px] font-bold">
                        {matter.counts.openTasks}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview">
                <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
                  <div className="flex flex-col gap-4">
                    {matter.description && (
                      <section className="rounded-lg border border-border bg-surface p-4">
                        <h3 className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-subtle">
                          {t("overview.summary")}
                        </h3>
                        <p className="whitespace-pre-wrap text-[12.5px] text-foreground-body">
                          {matter.description}
                        </p>
                      </section>
                    )}
                    <dl className="grid grid-cols-2 gap-3">
                      {(
                        [
                          ["opened", formatDate(matter.openedAt)],
                          ["lead", matter.leadLawyer.name],
                          ["hearings", String(matter.counts.hearings)],
                          ["documents", String(matter.counts.documents)],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k} className="rounded-lg border border-border bg-surface p-3">
                          <dt className="text-[11px] font-semibold text-muted">{t(`overview.${k}`)}</dt>
                          <dd className="text-[13.5px] font-bold text-foreground">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <MatterTimelineTab id={id} canWrite={canWrite} />
                  </div>
                  <MatterParticipants matter={matter} canWrite={canWrite} />
                </div>
              </TabsContent>

              <TabsContent value="hearings">
                <MatterHearingsTab id={id} />
              </TabsContent>
              <TabsContent value="tasks">
                <MatterTasksTab id={id} />
              </TabsContent>
              <TabsContent value="documents">
                <MatterDocumentsTab id={id} />
              </TabsContent>
              <TabsContent value="notes">
                <MatterNotesTab id={id} canWrite={canWrite} />
              </TabsContent>
              <TabsContent value="financials">
                <MatterFinancialsTab id={id} />
              </TabsContent>
              <TabsContent value="activity">
                <MatterActivityTab id={id} />
              </TabsContent>
            </Tabs>

            <MatterFormDialog open={editing} onOpenChange={setEditing} matter={matter} />
            <ConfirmDialog
              open={closing}
              onOpenChange={setClosing}
              title={t("close.title")}
              description={t("close.body")}
              confirmLabel={t("actions.close")}
              onConfirm={async () => {
                await close.mutateAsync();
                navigate("/matters");
              }}
            />
          </>
        )}
      </QueryBoundary>
    </PageContainer>
  );
}
