import { useTranslation } from "react-i18next";
import { isApiError } from "@/lib/api/api-error";
import { Icon } from "@/components/ui/icon";

interface ErrorStateProps {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
}

export function ErrorState({ error, onRetry, title }: ErrorStateProps) {
  const { t } = useTranslation("common");
  const message = isApiError(error) ? error.message : t("states.error_body");

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface px-6 py-16 text-center"
      role="alert"
      data-slot="error-state"
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-danger-surface text-danger">
        <Icon name="error" size={24} />
      </div>
      <div className="text-[15px] font-bold text-foreground">{title ?? t("states.error_title")}</div>
      <p className="max-w-sm text-[13px] text-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-bold text-primary-foreground hover:bg-primary-hover"
        >
          <Icon name="refresh" size={16} />
          {t("actions.retry")}
        </button>
      )}
    </div>
  );
}
