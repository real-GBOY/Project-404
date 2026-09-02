import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Crumb } from "@/components/ui/breadcrumb";
import { NAV_ITEMS } from "./nav";

/**
 * Route → breadcrumb trail, derived from the nav model. Feature detail pages
 * (F5+) will extend this with record names via a route handle; for now it
 * resolves the top-level section.
 */
export function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const { t } = useTranslation("common");

  return useMemo(() => {
    const match = NAV_ITEMS.filter(
      (item) => pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to)),
    ).sort((a, b) => b.to.length - a.to.length)[0];

    if (!match || match.to === "/") {
      return [{ label: t("nav.dashboard") }];
    }
    return [
      { label: t("nav.dashboard"), to: "/" },
      { label: t(`nav.${match.labelKey}`) },
    ];
  }, [pathname, t]);
}
