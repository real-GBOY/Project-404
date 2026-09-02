import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useSetPageChrome } from "@/lib/page-chrome";
import { formatDate, formatMoney } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Pill, type PillTone } from "@/components/ui/badge";
import { MatterChip } from "@/components/ui/matter-chip";
import { DetailField } from "@/components/ui/detail-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PanelHeader } from "@/components/tables/list-card";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { Skeleton } from "@/components/feedback/skeleton";
import { useBillingMutations, useInvoice } from "../hooks/use-billing";
import { RecordPaymentDialog } from "../components/record-dialogs";
import type { InvoiceStatus } from "../api/billing.api";

const TONE: Record<InvoiceStatus, PillTone> = {
  draft: "gray",
  issued: "blue",
  sent: "blue",
  paid: "green",
  void: "gray",
};

export function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation("billing");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const query = useInvoice(id);
  const { invoiceAction } = useBillingMutations();
  const [confirm, setConfirm] = useState<"issue" | "send" | "void" | null>(null);
  const [paying, setPaying] = useState(false);
  const canManage = can("issue:invoice");

  useSetPageChrome({
    title: query.data?.number ?? t("title"),
    parent: { label: t("title"), to: "/billing" },
  });

  return (
    <PageContainer>
      <QueryBoundary
        query={query}
        loading={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-96" />
          </div>
        }
      >
        {(inv) => {
          const money = (n: number) => formatMoney({ currency: inv.currency, amount: String(n) });
          const summaryRows: { label: string; value: string; strong?: boolean; tone?: PillTone }[] = [
            { label: t("totals.fees"), value: money(inv.totals.fees) },
            { label: t("totals.disbursements"), value: money(inv.totals.disbursements) },
            {
              label: t("totals.vat", { rate: Math.round(inv.vatRate * 100) }),
              value: money(inv.totals.vat),
            },
          ];

          return (
            <>
              <Card>
                <CardBody className="p-5">
                  <div className="flex flex-wrap items-start gap-3.5">
                    <button
                      type="button"
                      onClick={() => navigate("/billing")}
                      aria-label={t("common:actions.back")}
                      className="flex size-9 flex-none items-center justify-center rounded-btn border border-border-control text-secondary hover:bg-surface-subtle"
                    >
                      <Icon name="arrow_back" size={19} className="rtl:rotate-180" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-[19px] font-extrabold tracking-[-0.02em] text-foreground">
                          {inv.number}
                        </span>
                        <Pill tone={TONE[inv.status]}>{t(`invoice_status.${inv.status}`)}</Pill>
                      </div>
                      <div className="mt-1 text-[12.5px] font-medium text-muted">
                        {inv.issuedAt
                          ? t("issued_on", { date: formatDate(inv.issuedAt) })
                          : t("draft_not_issued")}
                        {inv.dueAt ? ` · ${t("due_on", { date: formatDate(inv.dueAt) })}` : ""} ·{" "}
                        {inv.terms}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" size="sm" icon="print">
                        {t("common:actions.print", { defaultValue: "Print" })}
                      </Button>
                      {canManage && inv.status === "draft" && (
                        <Button size="sm" icon="send" onClick={() => setConfirm("issue")}>
                          {t("actions.issue")}
                        </Button>
                      )}
                      {canManage && inv.status === "issued" && (
                        <Button variant="secondary" size="sm" icon="mail" onClick={() => setConfirm("send")}>
                          {t("actions.send")}
                        </Button>
                      )}
                      {can("record:payment") &&
                        (inv.status === "sent" || inv.status === "issued") && (
                          <Button size="sm" icon="add" onClick={() => setPaying(true)}>
                            {t("actions.record_payment")}
                          </Button>
                        )}
                      {can("void:invoice") && inv.status !== "paid" && inv.status !== "void" && (
                        <Button variant="secondary" size="sm" icon="block" onClick={() => setConfirm("void")}>
                          {t("actions.void")}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-4 border-t border-divider pt-4.5 md:grid-cols-4 lg:grid-cols-5">
                    <DetailField label={t("columns.client")} labelTone="warm">
                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${inv.clientId}`)}
                        className="text-link"
                      >
                        {inv.clientName}
                      </button>
                    </DetailField>
                    <DetailField label={t("columns.matter")} labelTone="warm">
                      {inv.matterReference ? (
                        <button type="button" onClick={() => inv.matterId && navigate(`/matters/${inv.matterId}`)}>
                          <MatterChip>{inv.matterReference}</MatterChip>
                        </button>
                      ) : (
                        "—"
                      )}
                    </DetailField>
                    <DetailField label={t("fields.matter_title", { defaultValue: "Matter title" })} labelTone="warm" className="lg:col-span-2">
                      <button
                        type="button"
                        onClick={() => inv.matterId && navigate(`/matters/${inv.matterId}`)}
                        className="truncate text-link"
                      >
                        {inv.matterTitle ?? "—"}
                      </button>
                    </DetailField>
                    <DetailField label={t("billing_partner", { defaultValue: "Billing partner" })} labelTone="warm">
                      {inv.billingPartner}
                    </DetailField>
                  </div>
                </CardBody>
              </Card>

              <div className="grid items-start gap-3.5 lg:grid-cols-[1.45fr_1fr]">
                <div className="flex flex-col gap-3.5">
                  <Card>
                    <PanelHeader title={t("totals.fees")} />
                    {inv.lines
                      .filter((l) => l.kind === "fee")
                      .map((l) => (
                        <div
                          key={l.id}
                          className="flex items-center gap-3 border-b border-divider-row px-[18px] py-3 last:border-0"
                        >
                          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground-body">
                            {l.description}
                          </span>
                          <span className="text-[13px] font-extrabold text-foreground">
                            {money(l.amount)}
                          </span>
                        </div>
                      ))}
                  </Card>

                  {inv.lines.some((l) => l.kind === "disbursement") && (
                    <Card>
                      <PanelHeader title={t("totals.disbursements")} />
                      {inv.lines
                        .filter((l) => l.kind === "disbursement")
                        .map((l) => (
                          <div
                            key={l.id}
                            className="flex items-center gap-3 border-b border-divider-row px-[18px] py-3 last:border-0"
                          >
                            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground-body">
                              {l.description}
                            </span>
                            <span className="text-[13px] font-extrabold text-foreground">
                              {money(l.amount)}
                            </span>
                          </div>
                        ))}
                    </Card>
                  )}

                  {inv.payments.length > 0 && (
                    <Card>
                      <PanelHeader title={t("payments_received")} />
                      {inv.payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 border-b border-divider-row px-[18px] py-3 last:border-0"
                        >
                          <span className="font-mono text-[12.5px] font-extrabold text-primary-deep">
                            {p.reference ?? "—"}
                          </span>
                          <span className="flex-1 text-[12.5px] font-semibold text-secondary">
                            {t(`method.${p.method}`, { defaultValue: p.method })}
                          </span>
                          <span className="text-[12.5px] font-semibold text-secondary">
                            {formatDate(p.receivedAt)}
                          </span>
                          <span className="text-[13px] font-extrabold text-success">
                            {formatMoney({ currency: p.currency, amount: String(p.amount) })}
                          </span>
                        </div>
                      ))}
                    </Card>
                  )}
                </div>

                <Card>
                  <PanelHeader title={t("common:summary", { defaultValue: "Summary" })} />
                  <CardBody className="flex flex-col gap-2.5">
                    {summaryRows.map((r) => (
                      <div key={r.label} className="flex items-center justify-between">
                        <span className="text-[12.5px] font-semibold text-secondary">{r.label}</span>
                        <span className="text-[13px] font-extrabold text-foreground">{r.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-divider pt-2.5">
                      <span className="text-[13px] font-extrabold text-foreground">
                        {t("totals.total")}
                      </span>
                      <span className="text-[16px] font-extrabold tracking-[-0.02em] text-foreground">
                        {money(inv.totals.total)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-semibold text-secondary">
                        {t("totals.received")}
                      </span>
                      <span className="text-[13px] font-extrabold text-success">
                        {money(inv.totals.paid)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-semibold text-secondary">
                        {t("totals.balance")}
                      </span>
                      <span className="text-[13px] font-extrabold text-danger">
                        {money(inv.totals.balance)}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </div>

              <ConfirmDialog
                open={confirm !== null}
                onOpenChange={(o) => !o && setConfirm(null)}
                title={t(`confirm.${confirm ?? "issue"}_title`)}
                description={t(`confirm.${confirm ?? "issue"}_body`)}
                confirmLabel={t(`actions.${confirm ?? "issue"}`)}
                destructive={confirm === "void"}
                onConfirm={async () => {
                  if (confirm) await invoiceAction.mutateAsync({ id, action: confirm });
                  setConfirm(null);
                }}
              />
              <RecordPaymentDialog open={paying} onOpenChange={setPaying} invoice={inv} />
            </>
          );
        }}
      </QueryBoundary>
    </PageContainer>
  );
}
