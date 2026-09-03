import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useSetPageChrome } from "@/lib/page-chrome";
import { useUrlParams } from "@/hooks/use-url-params";
import { httpClient } from "@/lib/api/http-client";
import { useToast } from "@/components/ui/toast-context";
import { PageContainer } from "@/components/ui/page-container";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  Cell,
  ColumnHeader,
  ListCard,
  ListRow,
  ListSearch,
  ListToolbar,
  ToolbarButton,
  ViewToggle,
} from "@/components/tables/list-card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { RowsSkeleton, Skeleton } from "@/components/feedback/skeleton";
import {
  getTeamMember,
  listTeam,
  teamKeys,
  updateTeamMember,
  type TeamMember,
  type TeamSummary,
} from "../api/team.api";

/** Prototype util-bar colour: >90 dark-red, >75 espresso, else tan. */
function UtilizationBar({ value }: { value: number }) {
  const color = value > 90 ? "#8c3b2e" : value > 75 ? "#16233a" : "#b99a5b";
  return (
    <div className="h-[7px] w-full overflow-hidden rounded-pill bg-chart-track" aria-hidden="true">
      <div className="h-full rounded-pill" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

function EditProfileDialog({
  member,
  onOpenChange,
}: {
  member: TeamMember | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation("team");
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [capacity, setCapacity] = useState("40");
  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof updateTeamMember>[1]) => updateTeamMember(member!.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.all });
      toast.success({ title: t("toasts.updated") });
      onOpenChange(false);
    },
    onError: () => toast.error({ title: t("toasts.failed") }),
  });

  return (
    <Dialog
      open={!!member}
      onOpenChange={(o) => {
        if (o && member) {
          setTitle(member.title);
          setPhone(member.phone ?? "");
          setCapacity(String(member.weeklyCapacityHours));
        }
        onOpenChange(o);
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("edit.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-3">
          <FormField label={t("fields.title")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label={t("fields.phone")}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
          <FormField label={t("fields.capacity")}>
            <Input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            loading={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                title,
                phone: phone || null,
                weeklyCapacityHours: Number(capacity),
              })
            }
          >
            {t("common:actions.save_changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function TeamPage() {
  const { t } = useTranslation("team");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const params = useUrlParams<"q" | "view">({ view: "table" });
  const view = (params.get("view") ?? "table") as "table" | "grid";
  const q = (params.get("q") ?? "").toLowerCase();
  const query = useQuery({ queryKey: teamKeys.all, queryFn: ({ signal }) => listTeam(signal) });
  const summary = useQuery({
    queryKey: ["team", "summary"],
    queryFn: ({ signal }) => httpClient<TeamSummary>("/team/summary", { signal }),
  });
  const [editing, setEditing] = useState<TeamMember | null>(null);

  useSetPageChrome({ title: t("title"), count: query.data?.items.length ?? null });

  const columns = [
    { key: "member", label: t("columns.member"), flex: 1.3 },
    { key: "role", label: t("columns.role"), width: 150 },
    { key: "dept", label: t("columns.department"), width: 150 },
    { key: "bar", label: t("columns.bar"), width: 150 },
    { key: "matters", label: t("columns.matters"), width: 90 },
    { key: "util", label: t("columns.utilisation"), width: 150 },
    { key: "status", label: t("columns.status"), width: 100 },
  ] as const;

  const s = summary.data;

  return (
    <PageContainer>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label={t("kpi.fee_earners")} value={s?.feeEarners ?? "—"} />
        <StatCard label={t("kpi.support")} value={s?.support ?? "—"} />
        <StatCard
          label={t("kpi.avg_util")}
          value={s ? `${s.avgUtilisation}%` : "—"}
        />
        <StatCard label={t("kpi.on_leave")} value={s?.onLeave ?? "—"} valueTone="warning" />
      </div>

      <ListCard>
        <ListToolbar>
          <ListSearch
            className="min-w-[270px]"
            value={params.get("q") ?? ""}
            placeholder={t("search_placeholder")}
            onChange={(v) => params.set({ q: v })}
          />
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <ToolbarButton icon="filter_list">{t("filter")}</ToolbarButton>
            <ViewToggle
              value={view}
              onChange={(v) => params.set({ view: v })}
              labels={{ table: t("common:table.view_table"), grid: t("common:table.view_grid") }}
            />
            {can("manage:staff") && (
              <Button size="sm" icon="person_add">
                {t("actions.add")}
              </Button>
            )}
          </div>
        </ListToolbar>

        <QueryBoundary query={query} loading={<RowsSkeleton rows={8} />}>
          {(data) => {
            const rows = q
              ? data.items.filter((u) =>
                  `${u.name} ${u.role} ${u.department}`.toLowerCase().includes(q),
                )
              : data.items;

            if (view === "grid") {
              return (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(262px,1fr))] gap-3.5 px-[18px] py-4">
                  {rows.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => navigate(`/team/${u.id}`)}
                      className="rounded-card border border-border bg-surface p-4 text-start transition-colors hover:border-border-accent hover:bg-surface-warm"
                    >
                      <div className="flex items-start gap-[11px]">
                        <span className="grid size-[42px] flex-none place-items-center rounded-full bg-surface-sand text-[13px] font-extrabold text-link">
                          {initials(u.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-bold text-foreground">{u.name}</div>
                          <div className="mt-0.5 text-[11.5px] font-semibold text-secondary">
                            {u.role}
                          </div>
                          <div className="text-[11px] font-medium text-muted">{u.department}</div>
                        </div>
                        <Pill tone={u.status === "active" ? "green" : "amber"}>
                          {t(`status.${u.status}`)}
                        </Pill>
                      </div>
                      <div className="mt-3.5 border-t border-divider pt-3.5">
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-subtle">
                            {t("columns.utilisation")}
                          </span>
                          <span className="text-[11.5px] font-extrabold">{u.utilization}%</span>
                        </div>
                        <UtilizationBar value={u.utilization} />
                        <div className="mt-2.5 text-[11px] font-semibold text-muted">
                          {u.activeMatters} {t("active_matters_word")} · {u.barAdmission}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            }

            return (
              <>
                <ColumnHeader columns={[...columns]} />
                {rows.map((u) => (
                  <ListRow key={u.id} onClick={() => navigate(`/team/${u.id}`)}>
                    <Cell col={columns[0]} className="flex items-center gap-[11px]">
                      <span className="grid size-[34px] flex-none place-items-center rounded-full bg-surface-sand text-[12px] font-extrabold text-link">
                        {initials(u.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-bold text-foreground">{u.name}</div>
                        <div className="truncate text-[11px] font-medium text-muted">{u.email}</div>
                      </div>
                    </Cell>
                    <Cell col={columns[1]} className="truncate text-foreground-body">
                      {u.role}
                    </Cell>
                    <Cell col={columns[2]} className="truncate">
                      {u.department}
                    </Cell>
                    <Cell col={columns[3]} className="truncate">
                      {u.barAdmission}
                    </Cell>
                    <Cell col={columns[4]} className="font-bold text-foreground">
                      {u.activeMatters}
                    </Cell>
                    <Cell col={columns[5]} className="flex items-center gap-2.5">
                      <div className="flex-1">
                        <UtilizationBar value={u.utilization} />
                      </div>
                      <span className="text-[11.5px] font-bold text-secondary">
                        {u.utilization}%
                      </span>
                    </Cell>
                    <Cell col={columns[6]} className="flex items-center gap-1">
                      <Pill tone={u.status === "active" ? "green" : "amber"}>
                        {t(`status.${u.status}`)}
                      </Pill>
                      {can("manage:staff") && u.status === "active" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(u);
                          }}
                          aria-label={t("common:actions.edit")}
                          className="flex size-6 items-center justify-center rounded text-faint hover:bg-surface-subtle"
                        >
                          <Icon name="edit" size={15} />
                        </button>
                      )}
                    </Cell>
                  </ListRow>
                ))}
              </>
            );
          }}
        </QueryBoundary>
      </ListCard>

      <EditProfileDialog member={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </PageContainer>
  );
}

export function TeamMemberPage() {
  const { userId = "" } = useParams();
  const { t } = useTranslation("team");
  const query = useQuery({
    queryKey: teamKeys.detail(userId),
    queryFn: ({ signal }) => getTeamMember(userId, signal),
  });

  return (
    <PageContainer>
      <QueryBoundary query={query} loading={<Skeleton className="h-72" />}>
        {(u) => (
          <>
            <Breadcrumb items={[{ label: t("common:nav.team"), to: "/team" }, { label: u.name }]} />
            <div className="flex items-center gap-3">
              <Avatar name={u.name} size="lg" />
              <div>
                <h1 className="text-[19px] font-extrabold tracking-tight text-foreground">{u.name}</h1>
                <p className="text-[12.5px] text-muted">
                  {u.title} · {u.email}
                  {u.phone ? ` · ${u.phone}` : ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["matters", u.activeMatters],
                  ["tasks", u.openTasks],
                  ["hearings", u.upcomingHearings],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-[11px] font-semibold text-muted">{t(k)}</div>
                  <div className="text-[18px] font-extrabold text-foreground">{v}</div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-1 flex items-center justify-between text-[11.5px] font-semibold text-muted">
                <span>{t("utilization")}</span>
                <span>{u.utilization}%</span>
              </div>
              <UtilizationBar value={u.utilization} />
            </div>

            <div>
              <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-subtle">
                {t("active_matters")}
              </h3>
              <div className="divide-y divide-divider rounded-lg border border-border bg-surface">
                {u.matters.map((m) => (
                  <Link
                    key={m.id}
                    to={`/matters/${m.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-surface-subtle"
                  >
                    <div>
                      <div className="text-[12.5px] font-semibold text-foreground">{m.title}</div>
                      <div className="text-[11px] text-muted">{m.reference}</div>
                    </div>
                    <Badge tone={m.role === "Lead" ? "brand" : "neutral"} size="sm">
                      {m.role}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </QueryBoundary>
    </PageContainer>
  );
}
