import { forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";
import type { InputProps } from "@/components/ui/input";

/** Password field with a show/hide toggle. Same API as `Input`. */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(
  { className, invalid, "aria-invalid": ariaInvalid, ...props },
  ref,
) {
  const { t } = useTranslation("auth");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        data-slot="input"
        aria-invalid={ariaInvalid ?? invalid ?? undefined}
        className={cn(
          "h-9 w-full rounded-md border border-border-control bg-surface ps-3 pe-9 text-[13px] text-foreground",
          "placeholder:text-subtle",
          "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-danger aria-[invalid=true]:outline-danger",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("password.hide") : t("password.show")}
        className="absolute end-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:bg-surface-subtle hover:text-foreground"
      >
        <Icon name={visible ? "visibility_off" : "visibility"} size={16} />
      </button>
    </div>
  );
});
