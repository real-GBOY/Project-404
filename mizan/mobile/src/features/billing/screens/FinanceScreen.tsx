import { useMemo } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatMoney, formatMoneyList } from "@/lib/format";
import type { Money } from "@/types/api";
import { colors, radii } from "@/theme/tokens";
import { fontFamily, fontSize } from "@/theme/typography";
import { TopBar } from "@/components/ui/TopBar";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MatterRefBadge } from "@/components/ui/MatterRefBadge";
import { Icon } from "@/components/ui/Icon";
import { useFinanceSummary, useInvoices } from "../hooks";
import { useUnbilledSummary } from "@/features/timeentries/hooks";

function moneyOrText(v: Money[] | string | undefined): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  return v.length ? formatMoneyList(v).join(" · ") : "—";
}

export default function FinanceScreen() {
  const { t } = useTranslation("billing");
  const summary = useFinanceSummary("invoices");
  const invoices = useInvoices();
  const unbilled = useUnbilledSummary(true);

  const overdue = useMemo(() => {
    const now = Date.now();
    return (invoices.data?.items ?? [])
      .filter(
        (i) =>
          (i.status === "issued" || i.status === "sent") &&
          i.dueAt &&
          new Date(i.dueAt).getTime() < now,
      )
      .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
  }, [invoices.data]);

  const overdueAmount = overdue.reduce<Record<string, number>>((acc, i) => {
    acc[i.currency] = (acc[i.currency] ?? 0) + i.balance;
    return acc;
  }, {});

  const unbilledByMatter = unbilled.data?.items ?? [];

  if (summary.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandDark} />
      </View>
    );
  }

  const s = summary.data;

  return (
    <View style={styles.screen}>
      <TopBar title={t("financeTitle")} onBack={() => router.back()} large />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{t("outstanding")}</Text>
          <Text style={styles.heroValue}>{moneyOrText(s?.c)}</Text>
          <View style={styles.heroTiles}>
            <View style={styles.heroTile}>
              <Text style={[styles.heroTileValue, { color: colors.brandBronze }]}>
                {Object.keys(overdueAmount).length
                  ? Object.entries(overdueAmount)
                      .map(([currency, amount]) =>
                        formatMoney({ currency, amount: amount.toFixed(0) }),
                      )
                      .join(" · ")
                  : "—"}
              </Text>
              <Text style={styles.heroTileLabel}>
                {t("overdue", { count: s?.overdue ?? overdue.length })}
              </Text>
            </View>
            <View style={styles.heroTile}>
              <Text style={styles.heroTileValue}>{moneyOrText(unbilled.data?.totals)}</Text>
              <Text style={styles.heroTileLabel}>{t("unbilledTime")}</Text>
            </View>
          </View>
        </View>

        {unbilledByMatter.length > 0 ? (
          <View>
            <SectionHeader label={t("myUnbilledTime")} />
            <Card radius="lgXl" padded={false}>
              {unbilledByMatter.map((m, i) => (
                <View
                  key={m.matterId}
                  style={[styles.unbilledRow, i < unbilledByMatter.length - 1 && styles.rowBorder]}
                >
                  {m.matterReference ? (
                    <MatterRefBadge reference={m.matterReference} small />
                  ) : null}
                  <Text style={styles.unbilledHrs}>{m.hours.toFixed(1)} hrs</Text>
                  <Text style={styles.unbilledValue}>
                    {m.value.length ? formatMoneyList(m.value).join(" · ") : "—"}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {overdue.length > 0 ? (
          <View>
            <SectionHeader label={t("overdueInvoices")} />
            <Card radius="lgXl" padded={false}>
              {overdue.map((inv, i) => {
                const days = Math.floor((Date.now() - new Date(inv.dueAt!).getTime()) / 86_400_000);
                return (
                  <View
                    key={inv.id}
                    style={[styles.invoiceRow, i < overdue.length - 1 && styles.rowBorder]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.invoiceNumber}>{inv.number}</Text>
                      <Text style={styles.invoiceClient} numberOfLines={1}>
                        {inv.clientName}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={styles.invoiceAmount}>
                        {formatMoney({ currency: inv.currency, amount: String(inv.balance) })}
                      </Text>
                      <StatusBadge label={`${days} ${days === 1 ? "day" : "days"}`} tone="danger" />
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}

        <View style={styles.lockBanner}>
          <Icon name="lock" size={20} color={colors.brandDeep} />
          <Text style={styles.lockText}>{t("desktopOnly")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  hero: { backgroundColor: colors.brandDark, borderRadius: radii.xxl, padding: 18 },
  heroLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.smMd,
    color: colors.brandTan,
    letterSpacing: 0.5,
  },
  heroValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.hero,
    color: colors.textOnDark,
    letterSpacing: -0.5,
    marginTop: 6,
  },
  heroTiles: { flexDirection: "row", gap: 10, marginTop: 16 },
  heroTile: { flex: 1, backgroundColor: colors.brandDeep, borderRadius: radii.mdLg, padding: 12 },
  heroTileValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.xl,
    color: colors.textOnDark,
  },
  heroTileLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    color: colors.brandTan,
    marginTop: 2,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderHairline },
  unbilledRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  unbilledHrs: {
    flex: 1,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.baseMd,
    color: colors.financeSecondary,
  },
  unbilledValue: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  invoiceNumber: {
    fontFamily: fontFamily.mono,
    fontWeight: "700",
    fontSize: fontSize.base,
    color: colors.brandAmberBannerText,
  },
  invoiceClient: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: 4,
  },
  invoiceAmount: {
    fontFamily: fontFamily.extrabold,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  lockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: colors.brandAmberBannerBg,
    borderWidth: 1,
    borderColor: colors.brandCreamBorder,
    borderRadius: radii.lgXl,
    padding: 14,
  },
  lockText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.base,
    color: colors.brandAmberBannerSubtext,
    lineHeight: 18,
  },
});
