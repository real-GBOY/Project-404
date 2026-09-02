import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { resendVerification, verifyEmail } from "@/lib/auth/auth-endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { FormField } from "@/components/forms/form-field";
import { AuthHeader } from "../components/auth-header";
import { resendVerificationSchema, type ResendVerificationValues } from "../schemas/auth.schema";

type State = "verifying" | "success" | "error";

function ResendForm() {
  const { t } = useTranslation("auth");
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResendVerificationValues>({ resolver: zodResolver(resendVerificationSchema) });

  if (sent) {
    return <p className="text-[12.5px] text-muted">{t("verify.resent")}</p>;
  }

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        await resendVerification(v.email).catch(() => undefined);
        setSent(true);
      })}
      noValidate
      className="flex w-full flex-col gap-3"
    >
      <FormField label={t("fields.email")} error={errors.email && t(errors.email.message ?? "")}>
        <Input type="email" autoComplete="email" {...register("email")} />
      </FormField>
      <Button type="submit" variant="secondary" loading={isSubmitting} className="w-full">
        {t("verify.resend")}
      </Button>
    </form>
  );
}

export function VerifyEmailPage() {
  const { t } = useTranslation("auth");
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>(token ? "verifying" : "error");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token).then(
      () => setState("success"),
      () => setState("error"),
    );
  }, [token]);

  if (state === "verifying") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Spinner size={24} className="text-muted" />
        <p className="text-[13px] text-muted">{t("verify.checking")}</p>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-success-surface text-success">
          <Icon name="check_circle" size={22} />
        </div>
        <AuthHeader title={t("verify.success_title")} subtitle={t("verify.success_subtitle")} />
        <Link to="/login" className="text-[12.5px] font-semibold text-link hover:underline">
          {t("verify.continue_to_login")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-danger-surface text-danger">
        <Icon name="error" size={22} />
      </div>
      <AuthHeader title={t("verify.error_title")} subtitle={t("verify.error_subtitle")} />
      <ResendForm />
      <Link to="/login" className="text-[12.5px] font-semibold text-muted hover:text-foreground-body">
        {t("common_back_to_login")}
      </Link>
    </div>
  );
}
