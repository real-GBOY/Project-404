import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useSetPageChrome } from "@/lib/page-chrome";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate, formatMoneyList } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Pill, type PillTone } from "@/components/ui/badge";
import { DetailField } from "@/components/ui/detail-field";
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
import {
  MatterActivityTab,
  MatterDocumentsTab,
  MatterFinancialsTab,
  MatterHearingsTab,
  MatterNotesTab,
  MatterOverview,
  MatterTasksTab,
} from "../components/matter-tabs";
import type { MatterStatus } from "../types/matter";

const TABS = ["overview", "hearings", "tasks", "documents", "notes", "financials", "activity"] as const;

const STATUS_TONE: Record<MatterStatus, PillTone> = {
  open: "green",
  on_hold: "amber",
  closed: "gray",
};

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

  useSetPageChrome({
    title: query.data?.reference ?? t("title"),
    parent: { label: t("case_work.title"), to: "/matters" },
  });

  return (
    <PageContainer>
      <QueryBoundary
        query={query}
        loading={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-44" />
            <Skeleton className="h-10 w-[28rem]" />
            <Skeleton className="h-64" />
          </div>
        }
      >
        {(matter) => (
          <>
            <Card>
              <CardBody className="p-5">
                <div className="flex flex-wrap items-start gap-3.5">
                  <button
                    type="button"
                    onClick={() => navigate("/matters")}
                    aria-label={t("common:actions.back")}
                    className="flex size-9 flex-none items-center justify-center rounded-btn border border-border-control text-secondary hover:bg-surface-subtle"
                  >
                    <Icon name="arrow_back" size={19} className="rtl:rotate-180" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[19px] font-extrabold tracking-[-0.02em] text-foreground">
                        {matter.title}
                      </span>
                      <Pill tone={STATUS_TONE[matter.status]}>{t(`status.${matter.status}`)}</Pill>
                    </div>
                    <div className="mt-1 text-[12.5px] font-medium text-muted">
                      {t("detail.opened", { date: formatDate(matter.openedAt) })} ·{" "}
                      {matter.practiceArea}
                      {matter.value.length > 0 && (
                        <>
                          {" · "}
                          {t("detail.claim_value", {
                            value: formatMoneyList(matter.value).join(" · "),
                          })}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canWrite && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={t("actions.more")}
                          className="flex size-9 items-center justify-center rounded-btn border border-border-control text-secondary hover:bg-surface-subtle"
                        >
                          <Icon name="more_vert" size={18} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem icon="edit" onSelect={() => setEditing(true)}>
                            {t("common:actions.edit")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="print"
                      onClick={() => window.print()}
                    >
                      {t("detail.export_file")}
                    </Button>
                    {canWrite && matter.status !== "closed" && can("close:matter") && (
                      <Button size="sm" onClick={() => setClosing(true)}>
                        {t("detail.close_matter")}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-divider pt-4.5 md:grid-cols-3 lg:grid-cols-5">
                  <DetailField label={t("detail.matter_type")}>{matter.practiceArea}</DetailField>
                  <DetailField label={t("detail.matter_no")}>{matter.reference}</DetailField>
                  <DetailField label={t("detail.court")}>{matter.court ?? "—"}</DetailField>
                  <DetailField label={t("detail.lead_lawyer")}>{matter.leadLawyer.name}</DetailField>
                  <DetailField label={t("detail.client")}>
                    <button
                      type="button"
                      onClick={() => navigate(`/clients/${matter.clientId}`)}
                      className="text-link"
                    >
                      {matter.clientName}
                    </button>
                  </DetailField>
                </div>
              </CardBody>
            </Card>

            <Tabs value={active} onValueChange={(v) => params.set({ tab: v })}>
              <TabsList>
                {TABS.map((name) => (
                  <TabsTrigger key={name} value={name}>
                    {t(`tabs.${name}`)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="pt-3.5">
                <MatterOverview matter={matter} canWrite={canWrite} />
              </TabsContent>
              <TabsContent value="hearings" className="pt-3.5">
                <MatterHearingsTab id={id} />
              </TabsContent>
              <TabsContent value="tasks" className="pt-3.5">
                <MatterTasksTab id={id} />
              </TabsContent>
              <TabsContent value="documents" className="pt-3.5">
                <MatterDocumentsTab id={id} count={matter.counts.documents} />
              </TabsContent>
              <TabsContent value="notes" className="pt-3.5">
                <MatterNotesTab id={id} canWrite={canWrite} />
              </TabsContent>
              <TabsContent value="financials" className="pt-3.5">
                <MatterFinancialsTab id={id} />
              </TabsContent>
              <TabsContent value="activity" className="pt-3.5">
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
