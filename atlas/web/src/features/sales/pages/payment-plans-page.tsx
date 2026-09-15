import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { DataTable, TextCell, BadgeCell } from "@/components/tables/data-table";
import type { DataColumn } from "@/components/tables/data-table";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { QuickCreateModal } from "@/components/tables/quick-create-modal";
import { cn } from "@/lib/cn";
import { formatEgpExact } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { titleCase } from "@/lib/text";
import { ApiError } from "@/lib/api/client";
import { useCustomers } from "@/api/crm";
import { useUnitDirectory } from "@/api/properties";
import { usePaymentPlans, usePaymentPlan, type InstallmentRow } from "@/api/sales";
import { useRecordPayment, type PaymentMethod } from "@/api/finance";

const scheduleColumns: DataColumn<InstallmentRow>[] = [
  { key: "label", label: "Installment", flex: 1.2, render: (r) => <TextCell value={r.label} /> },
  { key: "due", label: "Due date", width: 108, render: (r) => <TextCell value={formatDate(r.dueDate)} mono weight="normal" /> },
  { key: "amount", label: "Amount", width: 120, align: "end", render: (r) => <TextCell value={formatEgpExact(r.amountEgp)} mono /> },
  { key: "paid", label: "Paid", width: 120, align: "end", render: (r) => <TextCell value={formatEgpExact(r.paidEgp)} mono weight="normal" /> },
  { key: "status", label: "Status", width: 92, render: (r) => <BadgeCell status={titleCase(r.status)} /> },
];

export function PaymentPlansPage() {
  const plans = usePaymentPlans();
  const customers = useCustomers();
  const units = useUnitDirectory();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [recordOpen, setRecordOpen] = useState(false);
  const recordPayment = useRecordPayment();

  const activeId = selectedId ?? plans.data?.[0]?.id;
  const detail = usePaymentPlan(activeId);

  if (plans.isLoading || customers.isLoading || units.isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Payment Plans" />
        <RowsSkeleton rows={6} cols={4} />
      </PageContainer>
    );
  }

  const error = plans.error ?? customers.error ?? units.error;
  if (error) {
    return (
      <PageContainer>
        <PageHeader title="Payment Plans" />
        <ErrorState title="Couldn't load payment plans" message={error instanceof ApiError ? error.message : "The request failed."} />
      </PageContainer>
    );
  }

  const customerName = (id: string) => customers.data?.find((c) => c.id === id)?.name ?? id;
  const list = plans.data ?? [];

  if (list.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="Payment Plans" description="0 active plans" />
        <Card>
          <EmptyState icon="payment-plan" title="No payment plans yet" description="A payment plan is created once a contract is signed — none exist yet." />
        </Card>
      </PageContainer>
    );
  }

  const plan = detail.data;
  const paidEgp = plan ? plan.installments.reduce((s, i) => s + i.paidEgp, 0) : 0;
  const pctPaid = plan && plan.totalEgp > 0 ? (paidEgp / plan.totalEgp) * 100 : 0;
  const nextDue = plan?.installments.find((i) => i.status === "pending" || i.status === "partial" || i.status === "overdue");

  return (
    <PageContainer>
      <PageHeader title="Payment Plans" description={`${list.length} active plans · installment schedules from each plan's terms`} />

      <div className="flex flex-col gap-3 lg:flex-row">
        <Card className="lg:w-[280px] lg:flex-none">
          <CardHeader title="Active Plans" subtitle={`${list.length} plans`} />
          <div className="max-h-[560px] overflow-y-auto">
            {list.map((p) => {
              const u = units.byId.get(p.unitId);
              const selected = p.id === activeId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "block w-full border-b border-border-row px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-surface-hover",
                    selected && "bg-primary-surface-pale",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-body">{u?.code ?? p.unitId}</span>
                    <span className="font-mono text-[10px] text-secondary">{formatEgpExact(p.totalEgp)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] font-medium text-body">{customerName(p.customerId)}</div>
                  <div className="mt-0.5 truncate text-[10px] text-subtle">{u?.location ?? "—"}</div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {detail.isLoading || !plan ? (
            <Card>
              <RowsSkeleton rows={4} cols={3} />
            </Card>
          ) : (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-row px-3.5 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-foreground">{units.byId.get(plan.unitId)?.code ?? plan.unitId}</div>
                    <div className="mt-0.5 truncate text-[11px] text-secondary">{customerName(plan.customerId)}</div>
                  </div>
                  <div className="flex flex-none items-center gap-1.5">
                    <Button size="sm" onClick={() => setRecordOpen(true)} disabled={!nextDue}>
                      Record Payment
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-px overflow-hidden border-b border-border bg-border sm:grid-cols-4">
                  <div className="bg-surface px-3.5 py-2.5">
                    <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted">Total</div>
                    <div className="mt-1.5 font-mono text-[14px] font-semibold text-foreground">{formatEgpExact(plan.totalEgp)}</div>
                  </div>
                  <div className="bg-surface px-3.5 py-2.5">
                    <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted">Paid</div>
                    <div className="mt-1.5 font-mono text-[14px] font-semibold text-success">{formatEgpExact(paidEgp)}</div>
                  </div>
                  <div className="bg-surface px-3.5 py-2.5">
                    <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted">Remaining</div>
                    <div className="mt-1.5 font-mono text-[14px] font-semibold text-foreground">{formatEgpExact(plan.totalEgp - paidEgp)}</div>
                  </div>
                  <div className="bg-surface px-3.5 py-2.5">
                    <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted">Progress</div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <ProgressBar value={pctPaid} className="flex-1" />
                      <span className="w-9 flex-none text-end font-mono text-[11px] font-semibold text-secondary">{pctPaid.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-3.5 py-3 sm:grid-cols-4">
                  <Term label="Down Payment" value={`${plan.downPaymentPct}%`} />
                  <Term label="Installments" value={String(plan.installmentCount)} />
                  <Term label="Cadence" value={titleCase(plan.cadence)} />
                  <Term label="Start Date" value={formatDate(plan.startDate)} />
                </div>
              </Card>

              <Card>
                <CardHeader title="Installment Schedule" subtitle={`${plan.installments.length} installments`} />
                <DataTable columns={scheduleColumns} rows={plan.installments} rowKey={(r) => r.id} minWidth={560} />
              </Card>
            </>
          )}
        </div>
      </div>

      {plan && (
        <QuickCreateModal
          open={recordOpen}
          onOpenChange={setRecordOpen}
          config={{
            title: "Record Payment",
            submitLabel: "Record Payment",
            fields: [
              { name: "amountEgp", label: "Amount (EGP)", type: "number", required: true, defaultValue: nextDue ? String(nextDue.amountEgp - nextDue.paidEgp) : undefined },
              {
                name: "method",
                label: "Method",
                type: "select",
                required: true,
                defaultValue: "bank-transfer",
                options: [
                  { value: "bank-transfer", label: "Bank Transfer" },
                  { value: "cheque", label: "Cheque" },
                  { value: "cash", label: "Cash" },
                  { value: "card", label: "Card" },
                ],
              },
            ],
            onSubmit: async (values) => {
              await recordPayment.mutateAsync({
                customerId: plan.customerId,
                unitId: plan.unitId,
                installmentId: nextDue?.id ?? null,
                amountEgp: Number(values.amountEgp),
                method: values.method as PaymentMethod,
              });
            },
          }}
        />
      )}
    </PageContainer>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className="mt-0.5 text-[11.5px] font-medium text-body">{value}</div>
    </div>
  );
}
