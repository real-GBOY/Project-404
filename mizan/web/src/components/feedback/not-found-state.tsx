import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/icon";

interface NotFoundStateProps {
  /** when set, render a link back there */
  backTo?: string;
  backLabel?: string;
}

export function NotFoundState({ backTo, backLabel }: NotFoundStateProps) {
  const { t } = useTranslation("common");
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center"
      data-slot="not-found-state"
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-neutral-surface text-neutral">
        <Icon name="search_off" size={24} />
      </div>
      <div className="text-[15px] font-bold text-foreground">{t("states.not_found_title")}</div>
      <p className="max-w-sm text-[13px] text-muted">{t("states.not_found_body")}</p>
      {backTo && (
        <Link
          to={backTo}
          className="mt-1 inline-flex h-9 items-center gap-2 rounded-md border border-border-control px-4 text-[13px] font-bold text-foreground hover:bg-surface-subtle"
        >
          <Icon name="arrow_back" size={16} />
          {backLabel ?? t("actions.back")}
        </Link>
      )}
    </div>
  );
}
