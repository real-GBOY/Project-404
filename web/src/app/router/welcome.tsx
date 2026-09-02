import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { useDir } from "@/lib/i18n/use-dir";
import { formatDate, formatMoneyList } from "@/lib/format";

/**
 * F0 scaffold check — proves tokens, i18n/RTL, Icon, and formatting are wired.
 * Replaced by the real Dashboard route in F4.
 */
export function WelcomePage() {
  const { t, i18n } = useTranslation("common");
  const { locale, dir } = useDir();

  const toggleLocale = () => i18n.changeLanguage(locale === "ar" ? "en" : "ar");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-surface-sand text-link">
          <Icon name="gavel" size={22} />
        </div>
        <div>
          <div className="text-xl font-extrabold tracking-tight">{t("app_name")}</div>
          <div className="text-[13px] text-muted">F0 scaffold — foundation ready</div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 text-[13px]">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="font-semibold text-muted">Locale</dt>
          <dd>
            {locale} · {dir}
          </dd>
          <dt className="font-semibold text-muted">Date</dt>
          <dd>{formatDate(Date.now())}</dd>
          <dt className="font-semibold text-muted">Outstanding</dt>
          <dd className="flex flex-col">
            {formatMoneyList([
              { currency: "EGP", amount: "4360000" },
              { currency: "AED", amount: "24000" },
            ]).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </dd>
        </dl>
      </div>

      <button
        type="button"
        onClick={toggleLocale}
        className="inline-flex h-9 w-fit items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-bold text-primary-foreground hover:bg-primary-hover"
      >
        <Icon name="translate" size={16} />
        {locale === "ar" ? t("language.en") : t("language.ar")}
      </button>
    </div>
  );
}
