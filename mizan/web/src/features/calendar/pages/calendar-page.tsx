import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/toast-context";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSetPageChrome } from "@/lib/page-chrome";
import { cn } from "@/lib/cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/ui/combobox";
import { FormField } from "@/components/forms/form-field";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { Skeleton } from "@/components/feedback/skeleton";
import { useMatterFormOptions } from "@/features/matters/hooks/use-matters";
import { calendarKeys, createEvent, getCalendar, type CalendarItem } from "../api/calendar.api";

const KIND_STYLE: Record<CalendarItem["kind"], string> = {
  hearing: "bg-brandtone-surface text-brandtone",
  deadline: "bg-danger-surface text-danger",
  event: "bg-neutral-surface text-neutral",
};

const LEGEND: { swatch: string; key: string }[] = [
  { swatch: "bg-primary", key: "hearing" },
  { swatch: "bg-danger-solid", key: "filing" },
  { swatch: "bg-accent-1", key: "internal" },
  { swatch: "bg-subtle", key: "meeting" },
];

function monthMatrix(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const weeks: Date[][] = [];
  const cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const eventSchema = z.object({
  title: z.string().trim().min(2, "calendar.errors.title_required"),
  date: z.string().min(1, "calendar.errors.date_required"),
  time: z.string().min(1),
  matterId: z.string().optional(),
});

function NewEventDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation("calendar");
  const qc = useQueryClient();
  const toast = useToast();
  const options = useMatterFormOptions();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: { time: "10:00" },
  });
  const mutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: calendarKeys.all });
      toast.success({ title: t("toasts.created") });
    },
    onError: () => toast.error({ title: t("toasts.failed") }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (isSubmitting ? undefined : onOpenChange(o))}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("new_event.title")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async (v) => {
            await mutation.mutateAsync({
              title: v.title,
              kind: "meeting",
              startAt: new Date(`${v.date}T${v.time}:00`).toISOString(),
              matterId: v.matterId || null,
            });
            reset();
            onOpenChange(false);
          })}
          noValidate
        >
          <DialogBody className="flex flex-col gap-4 py-3">
            <FormField label={t("fields.title")} required error={errors.title && t(errors.title.message ?? "")}>
              <Input {...register("title")} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("fields.date")} required error={errors.date && t(errors.date.message ?? "")}>
                <DatePicker value={watch("date") ?? null} onValueChange={(val) => setValue("date", val ?? "", { shouldValidate: true })} />
              </FormField>
              <FormField label={t("fields.time")}>
                <Input type="time" {...register("time")} />
              </FormField>
            </div>
            <FormField label={t("fields.matter")}>
              <Combobox
                options={(options.data?.matters ?? []).map((m) => ({ value: m.id, label: m.name }))}
                value={watch("matterId") || null}
                onValueChange={(val) => setValue("matterId", val ?? "")}
                placeholder={t("fields.matter_none")}
              />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t("common:actions.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CalendarPage() {
  const { t, i18n } = useTranslation("calendar");
  const { can } = usePermissions();
  const options = useMatterFormOptions();
  const params = useUrlParams<"month" | "lawyer">({});
  const today = new Date();
  const monthParam = params.get("month");
  const [year, month] = monthParam
    ? monthParam.split("-").map(Number)
    : [today.getFullYear(), today.getMonth() + 1];
  const cursor = new Date(year, month - 1, 1);
  const lawyerId = params.get("lawyer");
  const [creating, setCreating] = useState(false);

  useSetPageChrome({ title: t("title") });

  const from = new Date(year, month - 1, 1);
  from.setDate(from.getDate() - 7);
  const to = new Date(year, month, 0);
  to.setDate(to.getDate() + 14);

  const query = useQuery({
    queryKey: calendarKeys.range(from.toISOString(), to.toISOString(), lawyerId ?? undefined),
    queryFn: ({ signal }) =>
      getCalendar({ from: from.toISOString(), to: to.toISOString(), lawyerId: lawyerId ?? undefined }, signal),
  });

  const weeks = useMemo(() => monthMatrix(year, month - 1), [year, month]);
  const locale = `${i18n.language.split("-")[0]}-EG`;
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2023, 0, 1 + i)),
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of query.data?.items ?? []) {
      const key = item.at.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [query.data]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    params.set({ month: `${d.getFullYear()}-${d.getMonth() + 1}` });
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label={t("prev_month")}
            className="flex size-[34px] items-center justify-center rounded-md border border-border-control bg-surface text-secondary hover:bg-surface-subtle"
          >
            <Icon name="chevron_left" size={18} className="rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label={t("next_month")}
            className="flex size-[34px] items-center justify-center rounded-md border border-border-control bg-surface text-secondary hover:bg-surface-subtle"
          >
            <Icon name="chevron_right" size={18} className="rtl:rotate-180" />
          </button>
        </div>
        <div className="text-[17px] font-extrabold tracking-[-0.02em] text-foreground">
          {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor)}
        </div>
        <SegmentedControl
          aria-label={t("view.label")}
          size="sm"
          value="month"
          onValueChange={() => {}}
          className="ms-2"
          options={[
            { value: "month", label: t("view.month") },
            { value: "week", label: t("view.week") },
            { value: "agenda", label: t("view.agenda") },
          ]}
        />
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Select
            value={lawyerId ?? "all"}
            onValueChange={(v) => params.set({ lawyer: v === "all" ? undefined : v })}
          >
            <SelectTrigger aria-label={t("filter_lawyer")} className="h-9 w-[11rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all_lawyers")}</SelectItem>
              {(options.data?.lawyers ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {can("create:event") && (
            <Button size="sm" icon="add" onClick={() => setCreating(true)}>
              {t("actions.new_event")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-[18px]">
        {LEGEND.map((l) => (
          <span key={l.key} className="flex items-center gap-[7px]">
            <span className={cn("size-[9px] rounded-[3px]", l.swatch)} />
            <span className="text-[11.5px] font-semibold text-secondary">{t(`legend.${l.key}`)}</span>
          </span>
        ))}
      </div>

      <QueryBoundary query={query} loading={<Skeleton className="h-[32rem]" />}>
        {() => (
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            <div className="grid grid-cols-7 border-b border-divider-row-2 bg-surface-subtle">
              {weekdays.map((w) => (
                <div
                  key={w}
                  className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-muted"
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {weeks.flat().map((day) => {
                const inMonth = day.getMonth() === month - 1;
                const key = day.toISOString().slice(0, 10);
                const items = byDay.get(key) ?? [];
                const isToday = key === today.toISOString().slice(0, 10);
                return (
                  <div
                    key={key}
                    className="flex min-h-[106px] flex-col gap-1 border-b border-e border-divider-faint p-[9px] last:border-e-0"
                  >
                    {isToday ? (
                      <div className="grid size-[22px] place-items-center rounded-full bg-primary text-[11.5px] font-extrabold text-primary-foreground">
                        {day.getDate()}
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "text-[12px]",
                          inMonth ? "font-bold text-foreground-body" : "font-semibold text-fainter",
                        )}
                      >
                        {day.getDate()}
                      </div>
                    )}
                    {items.slice(0, 3).map((item) => (
                      <Link
                        key={item.id}
                        to={item.matterId ? `/matters/${item.matterId}` : "/calendar"}
                        className={cn(
                          "truncate rounded-xs px-1.5 py-[3px] text-[10.5px] font-bold",
                          KIND_STYLE[item.kind],
                        )}
                        title={`${formatDate(item.at, { hour: "2-digit", minute: "2-digit" })} · ${item.title}`}
                      >
                        {formatDate(item.at, { hour: "2-digit", minute: "2-digit" })} {item.title}
                      </Link>
                    ))}
                    {items.length > 3 && (
                      <span className="px-1 text-[10px] font-bold text-muted">
                        {t("more", { count: items.length - 3 })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </QueryBoundary>

      <NewEventDialog open={creating} onOpenChange={setCreating} />
    </PageContainer>
  );
}
