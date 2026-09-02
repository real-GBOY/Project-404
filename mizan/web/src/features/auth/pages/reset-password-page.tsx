import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { resetPassword } from "@/lib/auth/auth-endpoints";
import { isApiError } from "@/lib/api/api-error";
import { useToast } from "@/components/ui/toast-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "../components/password-input";
import { AuthHeader } from "../components/auth-header";
import { resetPasswordSchema, type ResetPasswordValues } from "../schemas/auth.schema";

export function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-danger-surface text-danger">
          <Icon name="link_off" size={22} />
        </div>
        <AuthHeader title={t("reset.invalid_title")} subtitle={t("reset.invalid_subtitle")} />
        <Link to="/login/forgot" className="text-[12.5px] font-semibold text-link hover:underline">
          {t("reset.request_new")}
        </Link>
      </div>
    );
  }

  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null);
    try {
      await resetPassword(token, values.password);
      toast.success({ title: t("reset.success_toast") });
      navigate("/login", { replace: true });
    } catch (err) {
      setFormError(
        isApiError(err) && err.code === "identity.invalid_reset_token"
          ? t("reset.expired")
          : isApiError(err)
            ? err.message
            : t("reset.generic_error"),
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <AuthHeader title={t("reset.title")} subtitle={t("reset.subtitle")} />

      {formError && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-surface px-3 py-2 text-[12.5px] font-medium text-danger"
        >
          {formError}
        </div>
      )}

      <FormField
        label={t("fields.new_password")}
        hint={t("fields.password_hint")}
        error={errors.password && t(errors.password.message ?? "")}
      >
        <PasswordInput autoComplete="new-password" {...register("password")} />
      </FormField>

      <FormField
        label={t("fields.confirm_password")}
        error={errors.confirmPassword && t(errors.confirmPassword.message ?? "")}
      >
        <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
      </FormField>

      <Button type="submit" loading={isSubmitting} className="w-full">
        {t("reset.submit")}
      </Button>
    </form>
  );
}
