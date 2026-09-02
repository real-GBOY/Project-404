import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/toast-context";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/ui/breadcrumb";
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
} from "../api/team.api";

function UtilizationBar({ value }: { value: number }) {
  const tone = value >= 90 ? "bg-danger" : value >= 70 ? "bg-warning" : "bg-chart-fill";
  return (
    <div className="h-2 w-full rounded-full bg-chart-track" aria-hidden="true">
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
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

export function TeamPage() {
  const { t } = useTranslation("team");
  const { can } = usePermissions();
  const query = useQuery({ queryKey: teamKeys.all, queryFn: ({ signal }) => listTeam(signal) });
  const [editing, setEditing] = useState<TeamMember | null>(null);

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <QueryBoundary query={query} loading={<RowsSkeleton rows={5} />}>
        {(data) => (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((u) => (
              <div key={u.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-start justify-between">
                  <Link to={`/team/${u.id}`} className="flex items-center gap-3">
                    <Avatar name={u.name} size="md" />
                    <div>
                      <div className="text-[13.5px] font-bold text-foreground">{u.name}</div>
                      <div className="text-[11.5px] text-muted">{u.title}</div>
                    </div>
                  </Link>
                  {u.status === "inactive" ? (
                    <Badge tone="neutral" size="sm">
                      {t("status.inactive")}
                    </Badge>
                  ) : (
                    can("update:staff") && (
                      <button
                        type="button"
                        onClick={() => setEditing(u)}
                        aria-label={t("common:actions.edit")}
                        className="text-muted hover:text-foreground"
                      >
                        <Icon name="edit" size={15} />
                      </button>
                    )
                  )}
                </div>

                {u.practiceAreas.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {u.practiceAreas.map((a) => (
                      <span key={a} className="rounded bg-surface-subtle px-1.5 py-0.5 text-[10.5px] text-muted">
                        {a}
                      </span>
                    ))}
                  </div>
                )}

                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-muted">
                    <span>{t("utilization")}</span>
                    <span className="tabular-nums text-foreground-body">{u.utilization}%</span>
                  </div>
                  <UtilizationBar value={u.utilization} />
                </div>

                <div className="flex gap-4 border-t border-divider pt-2 text-[11.5px] text-muted">
                  <span>
                    {u.activeMatters} <span className="text-subtle">{t("matters")}</span>
                  </span>
                  <span>
                    {u.openTasks} <span className="text-subtle">{t("tasks")}</span>
                  </span>
                  <span>
                    {u.upcomingHearings} <span className="text-subtle">{t("hearings")}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryBoundary>
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
