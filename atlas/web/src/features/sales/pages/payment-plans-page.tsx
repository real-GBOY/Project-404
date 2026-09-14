import { useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { DataTable, TextCell, BadgeCell } from "@/components/tables/data-table";
import type { DataColumn } from "@/components/tables/data-table";
import { cn } from "@/lib/cn";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useToast } from "@/lib/toast/toast-provider";
import { PAYMENT_PLANS, PAYMENT_PLAN_TERMS, type PaymentPlanFixture } from "@/mocks/fixtures/payment-plans";

/**
 * The prototype's `PLANS` schedule is generated per-plan from fixed formulas
 * (see payment-plans.ts's header comment), not read from `installments.ts` —
 * `installments.ts` is only a 7-row cross-customer SAMPLE (one row per unit),
 * not a full per-plan schedule, so there's no clean join that would produce a
 * complete installment table for a selected plan. We reproduce the design's
 * own authored derivation instead, which IS a full, honest 10-line schedule.
 */
const SCHEDULE_DUE_DATES = [
  "11 Mar 2026",
  "25 Mar 2026",
  "25 Jun 2026",
  "25 Sep 2026",
  "25 Dec 2026",
  "25 Mar 2027",
  "25 Jun 2027",
  "25 Sep 2027",
  "25 Dec 2027",
  "25 Mar 2028",
];

interface ScheduleRow {
  idx: number;
  label: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: "Paid" | "Overdue" | "Pending";
}

function pctPaidOf(plan: PaymentPlanFixture): number {
  return (plan.paidEgp / plan.totalEgp) * 100;
}

function formatEgp(n: number): string {
  return `EGP ${Math.round(n).toLocaleString("en-US")}`;
}

function formatEgpMillions(n: number): string {
  return `EGP ${(n / 1_000_000).toFixed(2)}M`;
}

function buildSchedule(plan: PaymentPlanFixture): ScheduleRow[] {
  const pct = pctPaidOf(plan);
  const overdueIndex = Math.round(pct / 8) + 1;
  return SCHEDULE_DUE_DATES.map((dueDate, i) => {
    const label = i === 0 ? "Deposit" : i === 1 ? "Down payment" : `Installment ${i - 1}`;
    const amount = Math.round(plan.totalEgp * (i === 0 ? 0.03 : i === 1 ? 0.17 : 0.06));
    const isPaidByProgress = pct > i * 8;
    const status: ScheduleRow["status"] = isPaidByProgress ? "Paid" : i === overdueIndex ? "Overdue" : "Pending";
    const paidAmount = status === "Paid" ? amount : 0;
    return { idx: i, label, dueDate, amount, paidAmount, status };
  });
}

const scheduleColumns: DataColumn<ScheduleRow>[] = [
  { key: "label", label: "Installment", flex: 1.2, render: (r) => <TextCell value={r.label} /> },
  { key: "due", label: "Due date", width: 108, render: (r) => <TextCell value={r.dueDate} mono weight="normal" /> },
  { key: "amount", label: "Amount", width: 120, align: "end", render: (r) => <TextCell value={formatEgp(r.amount)} mono /> },
  { key: "paid", label: "Paid", width: 120, align: "end", render: (r) => <TextCell value={formatEgp(r.paidAmount)} mono weight="normal" /> },
  { key: "status", label: "Status", width: 92, render: (r) => <BadgeCell status={r.status} /> },
];

export function PaymentPlansPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [selectedUnitId, setSelectedUnitId] = useState(PAYMENT_PLANS[0]?.unitId);

  const plan = useMemo(
    () => PAYMENT_PLANS.find((p) => p.unitId === selectedUnitId) ?? PAYMENT_PLANS[0],
    [selectedUnitId],
  );

  const pctPaid = plan ? pctPaidOf(plan) : 0;
  const schedule = useMemo(() => (plan ? buildSchedule(plan) : []), [plan]);
  const terms = useMemo(
    () =>
      plan
        ? PAYMENT_PLAN_TERMS.map((t) => ({
            label: t.label,
            value: t.value.replace("{installmentCount}", String(plan.installmentCount)),
          }))
        : [],
    [plan],
  );

  async function handleReschedule() {
    if (!plan) return;
    const ok = await confirm({
      title: "Reschedule payment plan?",
      body: `This is a mock action — no backend is connected yet. It would adjust the remaining installment dates for ${plan.customer} (${plan.unitId}).`,
      cta: "Reschedule",
    });
    if (ok) toast.push({ kind: "success", title: "Plan rescheduled", body: `${plan.unitId} · ${plan.customer}` });
  }

  async function handleRecordPayment() {
    if (!plan) return;
    const ok = await confirm({
      title: "Record payment?",
      body: `This is a mock action — no backend is connected yet. It would apply a payment against ${plan.customer}'s next due installment.`,
      cta: "Record Payment",
    });
    if (ok) toast.push({ kind: "success", title: "Payment recorded", body: `${plan.unitId} · ${plan.customer}` });
  }

  if (!plan) {
    return (
      <PageContainer>
        <PageHeader title="Payment Plans" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Payment Plans" description={`${PAYMENT_PLANS.length} active plans · installment schedules derived from each plan's terms`} />

      <div className="flex flex-col gap-3 lg:flex-row">
        <Card className="lg:w-[280px] lg:flex-none">
          <CardHeader title="Active Plans" subtitle={`${PAYMENT_PLANS.length} plans`} />
          <div className="max-h-[560px] overflow-y-auto">
            {PAYMENT_PLANS.map((p) => {
              const pct = Math.round(pctPaidOf(p));
              const selected = p.unitId === plan.unitId;
              return (
                <button
                  key={p.unitId}
                  type="button"
                  onClick={() => setSelectedUnitId(p.unitId)}
                  className={cn(
                    "block w-full border-b border-border-row px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-surface-hover",
                    selected && "bg-primary-surface-pale",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-body">{p.unitId}</span>
                    <span className="font-mono text-[10px] text-secondary">{pct}%</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] font-medium text-body">{p.customer}</div>
                  <div className="mt-0.5 truncate text-[10px] text-subtle">{p.project}</div>
                  <ProgressBar value={pct} height={4} className="mt-1.5" />
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-row px-3.5 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-foreground">
                  {plan.unitId} · {plan.project}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-secondary">{plan.customer}</div>
              </div>
              <div className="flex flex-none items-center gap-1.5">
                <Button variant="secondary" size="sm" onClick={handleReschedule}>
                  Reschedule
                </Button>
                <Button size="sm" onClick={handleRecordPayment}>
                  Record Payment
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px overflow-hidden border-b border-border bg-border sm:grid-cols-4">
              <div className="bg-surface px-3.5 py-2.5">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted">Total</div>
                <div className="mt-1.5 font-mono text-[14px] font-semibold text-foreground">{formatEgpMillions(plan.totalEgp)}</div>
              </div>
              <div className="bg-surface px-3.5 py-2.5">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted">Paid</div>
                <div className="mt-1.5 font-mono text-[14px] font-semibold text-success">{formatEgpMillions(plan.paidEgp)}</div>
              </div>
              <div className="bg-surface px-3.5 py-2.5">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted">Remaining</div>
                <div className="mt-1.5 font-mono text-[14px] font-semibold text-foreground">
                  {formatEgpMillions(plan.totalEgp - plan.paidEgp)}
                </div>
              </div>
              <div className="bg-surface px-3.5 py-2.5">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted">Progress</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <ProgressBar value={pctPaid} className="flex-1" />
                  <span className="w-9 flex-none text-end font-mono text-[11px] font-semibold text-secondary">
                    {pctPaid.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-3.5 py-3 sm:grid-cols-3">
              {terms.map((t) => (
                <div key={t.label}>
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">{t.label}</div>
                  <div className="mt-0.5 text-[11.5px] font-medium text-body">{t.value}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Installment Schedule" subtitle={`${schedule.length} installments · ${plan.installmentCount}-installment plan`} />
            <DataTable columns={scheduleColumns} rows={schedule} rowKey={(r) => String(r.idx)} minWidth={560} />
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
