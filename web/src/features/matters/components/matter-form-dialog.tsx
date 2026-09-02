import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
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
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { Skeleton } from "@/components/feedback/skeleton";
import { useMatterFormOptions, useMatterMutations } from "../hooks/use-matters";
import { matterSchema, type MatterFormValues } from "../schemas/matter.schema";
import type { Matter } from "../types/matter";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matter?: Matter;
  /** preset client when opened from a client profile */
  clientId?: string;
}

export function MatterFormDialog({ open, onOpenChange, matter, clientId }: Props) {
  const { t } = useTranslation("matters");
  const navigate = useNavigate();
  const editing = !!matter;
  const options = useMatterFormOptions();
  const { create, update } = useMatterMutations(matter?.id);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MatterFormValues>({
    resolver: zodResolver(matterSchema),
    defaultValues: matter
      ? {
          title: matter.title,
          clientId: matter.clientId,
          practiceArea: matter.practiceArea,
          court: matter.court ?? undefined,
          description: matter.description ?? undefined,
        }
      : { clientId: clientId ?? "" },
  });

  async function onSubmit(values: MatterFormValues) {
    const parsed = matterSchema.parse(values);
    if (editing) {
      await update.mutateAsync(parsed);
      onOpenChange(false);
    } else {
      const created = await create.mutateAsync(parsed);
      onOpenChange(false);
      navigate(`/matters/${created.id}`);
    }
  }

  const selectedClient = watch("clientId");
  const selectedArea = watch("practiceArea");

  return (
    <Dialog open={open} onOpenChange={(o) => (isSubmitting ? undefined : onOpenChange(o))}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{editing ? t("form.edit_title") : t("form.new_title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogBody className="flex flex-col gap-4 py-3">
            {options.isPending ? (
              <Skeleton className="h-40" />
            ) : (
              <>
                <FormField
                  label={t("fields.title")}
                  required
                  error={errors.title && t(errors.title.message ?? "")}
                >
                  <Input autoComplete="off" {...register("title")} />
                </FormField>

                <FormField
                  label={t("fields.client")}
                  required
                  error={errors.clientId && t(errors.clientId.message ?? "")}
                >
                  <Combobox
                    options={(options.data?.clients ?? []).map((c) => ({ value: c.id, label: c.name }))}
                    value={selectedClient || null}
                    onValueChange={(v) => setValue("clientId", v ?? "", { shouldValidate: true })}
                    placeholder={t("fields.client_placeholder")}
                  />
                </FormField>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label={t("fields.practice_area")}
                    required
                    error={errors.practiceArea && t(errors.practiceArea.message ?? "")}
                  >
                    <Select
                      value={selectedArea}
                      onValueChange={(v) => setValue("practiceArea", v, { shouldValidate: true })}
                    >
                      <SelectTrigger aria-label={t("fields.practice_area")}>
                        <SelectValue placeholder={t("fields.select")} />
                      </SelectTrigger>
                      <SelectContent>
                        {(options.data?.practiceAreas ?? []).map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  <FormField label={t("fields.court")}>
                    <Select
                      value={watch("court") ?? ""}
                      onValueChange={(v) => setValue("court", v || undefined)}
                    >
                      <SelectTrigger aria-label={t("fields.court")}>
                        <SelectValue placeholder={t("fields.court_none")} />
                      </SelectTrigger>
                      <SelectContent>
                        {(options.data?.courts ?? []).map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>

                <FormField label={t("fields.description")}>
                  <Textarea rows={3} {...register("description")} />
                </FormField>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={options.isPending}>
              {editing ? t("common:actions.save_changes") : t("form.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
