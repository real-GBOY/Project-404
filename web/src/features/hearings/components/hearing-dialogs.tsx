import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/ui/combobox";
import { FormField } from "@/components/forms/form-field";
import { useMatterFormOptions } from "@/features/matters/hooks/use-matters";
import { useHearingMutations } from "../hooks/use-hearings";
import type { HearingRow } from "../api/hearings.api";

const scheduleSchema = z.object({
  matterId: z.string().min(1, "hearings.errors.matter_required"),
  date: z.string().min(1, "hearings.errors.date_required"),
  time: z.string().min(1, "hearings.errors.time_required"),
  purpose: z.string().trim().min(2, "hearings.errors.purpose_required"),
  court: z.string().trim().optional(),
});
type ScheduleValues = z.infer<typeof scheduleSchema>;

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function ScheduleHearingDialog({
  open,
  onOpenChange,
  matterId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matterId?: string;
}) {
  const { t } = useTranslation("hearings");
  const options = useMatterFormOptions();
  const { schedule } = useHearingMutations(matterId);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { matterId: matterId ?? "", time: "10:00" },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (isSubmitting ? undefined : onOpenChange(o))}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("schedule.title")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async (v) => {
            await schedule.mutateAsync({
              matterId: v.matterId,
              scheduledAt: toIso(v.date, v.time),
              purpose: v.purpose,
              court: v.court || undefined,
            });
            reset();
            onOpenChange(false);
          })}
          noValidate
        >
          <DialogBody className="flex flex-col gap-4 py-3">
            {!matterId && (
              <FormField
                label={t("fields.matter")}
                required
                error={errors.matterId && t(errors.matterId.message ?? "")}
              >
                <Combobox
                  options={(options.data?.matters ?? []).map((m) => ({ value: m.id, label: m.name }))}
                  value={watch("matterId") || null}
                  onValueChange={(val) => setValue("matterId", val ?? "", { shouldValidate: true })}
                  placeholder={t("fields.matter_placeholder")}
                />
              </FormField>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("fields.date")} required error={errors.date && t(errors.date.message ?? "")}>
                <DatePicker value={watch("date") ?? null} onValueChange={(v) => setValue("date", v ?? "", { shouldValidate: true })} />
              </FormField>
              <FormField label={t("fields.time")} required error={errors.time && t(errors.time.message ?? "")}>
                <Input type="time" {...register("time")} />
              </FormField>
            </div>
            <FormField label={t("fields.purpose")} required error={errors.purpose && t(errors.purpose.message ?? "")}>
              <Input {...register("purpose")} />
            </FormField>
            <FormField label={t("fields.court")}>
              <Input {...register("court")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t("schedule.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const adjournSchema = z.object({
  date: z.string().min(1, "hearings.errors.date_required"),
  reason: z.string().trim().optional(),
});

export function AdjournDialog({
  hearing,
  onOpenChange,
}: {
  hearing: HearingRow | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation("hearings");
  const { adjourn } = useHearingMutations(hearing?.matterId);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof adjournSchema>>({ resolver: zodResolver(adjournSchema) });

  return (
    <Dialog open={!!hearing} onOpenChange={(o) => (isSubmitting ? undefined : onOpenChange(o))}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("adjourn.title")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async (v) => {
            if (!hearing) return;
            await adjourn.mutateAsync({
              id: hearing.id,
              newDate: new Date(`${v.date}T${hearing.scheduledAt.slice(11, 16)}:00`).toISOString(),
              reason: v.reason || undefined,
            });
            reset();
            onOpenChange(false);
          })}
          noValidate
        >
          <DialogBody className="flex flex-col gap-4 py-3">
            <FormField label={t("adjourn.new_date")} required error={errors.date && t(errors.date.message ?? "")}>
              <DatePicker
                value={watch("date") ?? null}
                onValueChange={(v) => setValue("date", v ?? "", { shouldValidate: true })}
              />
            </FormField>
            <FormField label={t("adjourn.reason")}>
              <Textarea rows={2} {...register("reason")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t("adjourn.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const outcomeSchema = z.object({ outcome: z.string().trim().min(3, "hearings.errors.outcome_required") });

export function OutcomeDialog({
  hearing,
  onOpenChange,
}: {
  hearing: HearingRow | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation("hearings");
  const { outcome } = useHearingMutations(hearing?.matterId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof outcomeSchema>>({ resolver: zodResolver(outcomeSchema) });

  return (
    <Dialog open={!!hearing} onOpenChange={(o) => (isSubmitting ? undefined : onOpenChange(o))}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("outcome.title")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async (v) => {
            if (!hearing) return;
            await outcome.mutateAsync({ id: hearing.id, outcome: v.outcome });
            reset();
            onOpenChange(false);
          })}
          noValidate
        >
          <DialogBody className="py-3">
            <FormField
              label={t("outcome.label")}
              required
              error={errors.outcome && t(errors.outcome.message ?? "")}
            >
              <Textarea rows={3} {...register("outcome")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {t("outcome.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
