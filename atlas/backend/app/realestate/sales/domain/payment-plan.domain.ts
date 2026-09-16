/**
 * Generates an installment schedule for a payment plan — pure function, no
 * DB/framework. Consolidates the frontend's two disconnected "installment"
 * concepts (see the plan's data-model note) into one real, persisted schedule.
 */
export interface InstallmentSpec {
  seqNo: number;
  label: string;
  dueDate: string;
  amountEgp: number;
}

const CADENCE_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, "semi-annual": 6, annual: 12 };

export function generateInstallmentSchedule(params: {
  totalEgp: number;
  downPaymentPct: number;
  installmentCount: number;
  cadence: string;
  startDate: string;
}): InstallmentSpec[] {
  const { totalEgp, downPaymentPct, installmentCount, cadence, startDate } = params;
  const downPayment = Math.round(totalEgp * (downPaymentPct / 100));
  const remaining = totalEgp - downPayment;
  const perInstallment = Math.floor(remaining / installmentCount);
  const lastAdjustment = remaining - perInstallment * installmentCount;
  const stepMonths = CADENCE_MONTHS[cadence] ?? 3;

  const schedule: InstallmentSpec[] = [
    { seqNo: 0, label: "Down payment", dueDate: startDate, amountEgp: downPayment },
  ];

  const start = new Date(startDate);
  for (let i = 1; i <= installmentCount; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + stepMonths * i);
    schedule.push({
      seqNo: i,
      label: `Installment ${i} / ${installmentCount}`,
      dueDate: due.toISOString().slice(0, 10),
      amountEgp: perInstallment + (i === installmentCount ? lastAdjustment : 0),
    });
  }
  return schedule;
}
