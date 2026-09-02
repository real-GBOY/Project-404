import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { forgotPassword } from "@/lib/auth/auth-endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { FormField } from "@/components/forms/form-field";
import { AuthHeader } from "../components/auth-header";
import { forgotPasswordSchema, type ForgotPasswordValues } from "../schemas/auth.schema";

export function ForgotPasswordPage() {
  const { t } = useTranslation("auth");
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordValues) {
    // The endpoint always 202s — never reveals whether the email exists.
    await forgotPassword(values.email).catch(() => undefined);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-success-surface text-success">
          <Icon name="mark_email_read" size={22} />
        </div>
        <AuthHeader title={t("forgot.sent_title")} subtitle={t("forgot.sent_subtitle")} />
        <Link
          to="/login"
          className="text-[12.5px] font-semibold text-link hover:underline"
        >
          {t("common_back_to_login")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <AuthHeader title={t("forgot.title")} subtitle={t("forgot.subtitle")} />

      <FormField label={t("fields.email")} error={errors.email && t(errors.email.message ?? "")}>
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- sole field on a dedicated screen */}
        <Input type="email" autoComplete="email" autoFocus {...register("email")} />
      </FormField>

      <Button type="submit" loading={isSubmitting} className="w-full">
        {t("forgot.submit")}
      </Button>

      <Link
        to="/login"
        className="text-center text-[12.5px] font-semibold text-muted hover:text-foreground-body"
      >
        {t("common_back_to_login")}
      </Link>
    </form>
  );
}
