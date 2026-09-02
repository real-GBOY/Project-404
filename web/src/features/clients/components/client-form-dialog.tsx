import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { FormField } from "@/components/forms/form-field";
import { useClientMutations } from "../hooks/use-clients";
import { clientSchema, type ClientFormValues } from "../schemas/client.schema";
import type { Client } from "../types/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** present → edit mode */
  client?: Client;
}

export function ClientFormDialog({ open, onOpenChange, client }: Props) {
  const { t } = useTranslation("clients");
  const navigate = useNavigate();
  const editing = !!client;
  const { create, update } = useClientMutations(client?.id);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: client
      ? {
          name: client.name,
          type: client.type,
          email: client.email ?? undefined,
          phone: client.phone ?? undefined,
          taxId: client.taxId ?? undefined,
          address: client.address ?? undefined,
          notes: client.notes ?? undefined,
        }
      : { type: "company" },
  });

  async function onSubmit(values: ClientFormValues) {
    const parsed = clientSchema.parse(values);
    if (editing) {
      await update.mutateAsync(parsed);
      onOpenChange(false);
    } else {
      const created = await create.mutateAsync(parsed);
      onOpenChange(false);
      reset();
      navigate(`/clients/${created.id}`);
    }
  }

  const type = watch("type");

  return (
    <Dialog open={open} onOpenChange={(o) => (isSubmitting ? undefined : onOpenChange(o))}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{editing ? t("form.edit_title") : t("form.new_title")}</DialogTitle>
          <DialogDescription>{t("form.subtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogBody className="flex flex-col gap-4 py-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-foreground-body">
                {t("fields.type")}
              </span>
              <SegmentedControl
                aria-label={t("fields.type")}
                value={type ?? "company"}
                onValueChange={(v) => setValue("type", v as "company" | "individual")}
                options={[
                  { value: "company", label: t("type.company") },
                  { value: "individual", label: t("type.individual") },
                ]}
              />
            </div>

            <FormField
              label={t("fields.name")}
              required
              error={errors.name && t(errors.name.message ?? "")}
            >
              <Input autoComplete="off" {...register("name")} />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t("fields.email")} error={errors.email && t(errors.email.message ?? "")}>
                <Input type="email" autoComplete="off" {...register("email")} />
              </FormField>
              <FormField label={t("fields.phone")}>
                <Input autoComplete="off" {...register("phone")} />
              </FormField>
            </div>

            <FormField label={type === "company" ? t("fields.tax_id") : t("fields.national_id")}>
              <Input autoComplete="off" {...register("taxId")} />
            </FormField>

            <FormField label={t("fields.address")}>
              <Textarea rows={2} {...register("address")} />
            </FormField>

            <FormField label={t("fields.notes")}>
              <Textarea rows={3} {...register("notes")} />
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {editing ? t("common:actions.save_changes") : t("form.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
