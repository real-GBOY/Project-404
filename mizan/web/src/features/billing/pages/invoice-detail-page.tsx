import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { formatDate, formatMoney } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { Skeleton } from "@/components/feedback/skeleton";
import { useBillingMutations, useInvoice } from "../hooks/use-billing";
import { InvoiceStatusBadge } from "../components/billing-badges";
import { RecordPaymentDialog } from "../components/record-dialogs";

export function InvoiceDetailPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation("billing");
  const { can } = usePermissions();
  const query = useInvoice(id);
  const { invoiceAction } = useBillingMutations();
  const [confirm, setConfirm] = useState<"issue" | "send" | "void" | null>(null);
  const [paying, setPaying] = useState(false);
  const canManage = can("issue:invoice");

  return (
    <PageContainer>
      <QueryBoundary
        query={query}
        loading={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-96" />
          </div>
        }
      >
        {(inv) => {
          const row = (label: string, value: string, strong = false) => (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[12.5px] text-muted">{label}</span>
              <span className={`tabular-nums ${strong ? "text-[14px] font-bold text-foreground" : "text-[12.5px] text-foreground-body"}`}>
                {value}
              </span>
            </div>
          );
          const m = (n: number) => formatMoney({ currency: inv.currency, amount: String(n) });

          return (
            <>
              <Breadcrumb
                items={[
                  { label: t("common:nav.finance"), to: "/billing" },
                  { label: inv.number },
                ]}
              />

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-[19px] font-extrabold tracking-tight text-foreground">{inv.number}</h1>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                  <p className="text-[12.5px] text-muted">
                    <Link to={`/clients/${inv.clientId}`} className="text-link hover:underline">
                      {inv.clientName}
                    </Link>
                    {inv.matterId && (
                      <>
                        {" · "}
                        <Link to={`/matters/${inv.matterId}`} className="text-link hover:underline">
                          {inv.matterTitle}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canManage && inv.status === "draft" && (
                    <Button icon="send" onClick={() => setConfirm("issue")}>
                      {t("actions.issue")}
                    </Button>
                  )}
                  {canManage && inv.status === "issued" && (
                    <Button icon="mail" onClick={() => setConfirm("send")}>
                      {t("actions.send")}
                    </Button>
                  )}
                  {can("record:payment") && (inv.status === "sent" || inv.status === "issued") && (
                    <Button icon="add_card" onClick={() => setPaying(true)}>
                      {t("actions.record_payment")}
                    </Button>
                  )}
                  {can("void:invoice") && inv.status !== "paid" && inv.status !== "void" && (
                    <Button variant="secondary" icon="block" onClick={() => setConfirm("void")}>
                      {t("actions.void")}
                    </Button>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface p-5">
                <div className="mb-3 flex justify-between text-[12px] text-muted">
                  <span>{inv.issuedAt ? t("issued_on", { date: formatDate(inv.issuedAt) }) : t("draft_not_issued")}</span>
                  {inv.dueAt && <span>{t("due_on", { date: formatDate(inv.dueAt) })}</span>}
                </div>

                <table className="w-full text-[12.5px]">
                  <tbody>
                    {inv.lines.map((l) => (
                      <tr key={l.id} className="border-b border-divider">
                        <td className="py-2 text-foreground-body">
                          {l.description}
                          <span className="ms-2 rounded bg-surface-subtle px-1 text-[10px] font-semibold text-muted">
                            {t(`line_kind.${l.kind}`)}
                          </span>
                        </td>
                        <td className="py-2 text-end tabular-nums text-foreground">{m(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-3 border-t border-border pt-2">
                  {row(t("totals.fees"), m(inv.totals.fees))}
                  {row(t("totals.disbursements"), m(inv.totals.disbursements))}
                  {row(t("totals.vat", { rate: Math.round(inv.vatRate * 100) }), m(inv.totals.vat))}
                  {row(t("totals.total"), m(inv.totals.total), true)}
                  {inv.totals.paid > 0 && row(t("totals.received"), `− ${m(inv.totals.paid)}`)}
                  {row(t("totals.balance"), m(inv.totals.balance), true)}
                </div>
              </div>

              {inv.payments.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-subtle">
                    {t("payments_received")}
                  </h3>
                  <div className="divide-y divide-divider rounded-lg border border-border bg-surface">
                    {inv.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-[12.5px]">
                        <span className="text-muted">
                          {formatDate(p.receivedAt)} · {t(`method.${p.method}`)}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </span>
                        <span className="font-semibold tabular-nums text-success">
                          {formatMoney({ currency: p.currency, amount: String(p.amount) })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
