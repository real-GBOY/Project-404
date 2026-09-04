import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/use-auth";
import { isApiError } from "@/lib/api/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "../components/password-input";
import { AuthHeader } from "../components/auth-header";
import { loginSchema, type LoginValues } from "../schemas/auth.schema";

export function LoginPage() {
  const { t } = useTranslation("auth");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    // Demo deployments set VITE_DEMO_* so the form arrives pre-filled and a
    // visitor can sign straight in. Unset in a normal build → empty fields.
    defaultValues: {
      email: import.meta.env.VITE_DEMO_EMAIL ?? "",
      password: import.meta.env.VITE_DEMO_PASSWORD ?? "",
    },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    try {
      const outcome = await login(values.email, values.password);
      if (outcome.hasNoOrg || outcome.needsOrgSelection) {
        navigate("/login/organization", { replace: true, state: { from } });
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "identity.invalid_credentials") {
          setFormError(t("login.errors.invalid_credentials"));
          return;
        }
        if (err.code === "identity.account_not_active") {
          setFormError(err.message);
          return;
        }
        for (const f of err.fields) {
          if (f.path === "email" || f.path === "password") {
            setError(f.path, { message: f.message });
          }
        }
        if (err.fields.length === 0) setFormError(err.message);
        return;
      }
      setFormError(t("login.errors.generic"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <AuthHeader title={t("login.title")} subtitle={t("login.subtitle")} />

      {formError && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-surface px-3 py-2 text-[12.5px] font-medium text-danger"
        >
          {formError}
        </div>
      )}

      <FormField label={t("fields.email")} error={errors.email && t(errors.email.message ?? "")}>
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- first field on a dedicated sign-in screen */}
        <Input type="email" autoComplete="email" autoFocus {...register("email")} />
      </FormField>

      <FormField
        label={t("fields.password")}
        error={errors.password && t(errors.password.message ?? "")}
      >
        <PasswordInput autoComplete="current-password" {...register("password")} />
      </FormField>

      <div className="-mt-1 text-end">
        <Link to="/login/forgot" className="text-[12.5px] font-semibold text-link hover:underline">
          {t("login.forgot_link")}
        </Link>
      </div>

      <Button type="submit" loading={isSubmitting} className="w-full">
        {t("login.submit")}
      </Button>
    </form>
  );
}
