import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";

/** Shown by the route guard when the user lacks the required permission. */
export function ForbiddenState() {
  const { t } = useTranslation("common");
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center"
      data-slot="forbidden-state"
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-warning-surface text-warning">
        <Icon name="lock" size={24} />
      </div>
      <div className="text-[15px] font-bold text-foreground">{t("states.forbidden_title")}</div>
      <p className="max-w-sm text-[13px] text-muted">{t("states.forbidden_body")}</p>
    </div>
  );
}
