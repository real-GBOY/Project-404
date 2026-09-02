import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatMoneyList } from "@/lib/format";
import type { Money } from "@/types/api";

/**
 * Per-currency amounts as stacked lines. Never summed across currencies
 * (PLAN §6 — no FX). Falls back to a dash when empty.
 */
export function MoneyLines({
  amounts,
  className,
  align = "start",
}: {
  amounts: Money[];
  className?: string;
  align?: "start" | "end";
}) {
  const { t } = useTranslation("common");
  const lines = amounts.length ? formatMoneyList(amounts) : null;
  return (
    <span
      className={cn(
        "flex flex-col tabular-nums",
        align === "end" ? "items-end text-end" : "items-start",
        className,
      )}
    >
      {lines ? (
        lines.map((line) => <span key={line}>{line}</span>)
      ) : (
        <span className="text-muted">{t("none")}</span>
      )}
    </span>
  );
}
