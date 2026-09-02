import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { Icon } from "@/components/ui/icon";

/**
 * Stand-in for a feature page until its phase lands (F4+). Keeps the shell,
 * nav, guards and breadcrumb demoable end to end.
 */
export function PlaceholderPage({ titleKey, phase, icon }: { titleKey: string; phase: string; icon: string }) {
  const { t } = useTranslation("common");
  const params = useParams();
  const id = params.id;

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-surface-sand text-link">
          <Icon name={icon} size={24} />
        </div>
        <div className="text-[15px] font-bold text-foreground">{t(`nav.${titleKey}`)}</div>
        {id && <div className="text-[12px] font-medium text-muted">#{id}</div>}
        <p className="max-w-sm text-[13px] text-muted">{t("shell.coming_in", { phase })}</p>
      </div>
    </div>
  );
}
