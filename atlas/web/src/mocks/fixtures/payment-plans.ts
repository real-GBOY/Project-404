// Extracted verbatim from the design prototype's `PLANS` local array (inside `detailVals()`) that backs
// the Payment Plans screen, plus the pure derivation formulas used to build the selected plan's detail
// and installment schedule.

export interface PaymentPlanFixture {
  unitId: string;
  customer: string;
  project: string;
  /** Total contract value in EGP */
  totalEgp: number;
  /** Amount paid to date in EGP */
  paidEgp: number;
  /** Number of installments in the plan */
  installmentCount: number;
}

export const PAYMENT_PLANS: PaymentPlanFixture[] = [
  { unitId: 'B-1204', customer: 'Tarek ElGohary', project: 'North Hills', totalEgp: 4850000, paidEgp: 1450000, installmentCount: 16 },
  { unitId: 'A-0508', customer: 'Karim Abdelrahman', project: 'North Hills', totalEgp: 5800000, paidEgp: 3480000, installmentCount: 16 },
  { unitId: 'C-0311', customer: 'Hala Mostafa', project: 'Cedar Residences', totalEgp: 7800000, paidEgp: 5100000, installmentCount: 20 },
  { unitId: 'OFF-0904', customer: 'Omar Shaker', project: 'Skyline Business Park', totalEgp: 11200000, paidEgp: 4480000, installmentCount: 24 },
  { unitId: 'D-0705', customer: 'Sherif Zaki', project: 'Palm District', totalEgp: 7800000, paidEgp: 2340000, installmentCount: 20 },
  { unitId: 'WA-118', customer: 'Ziad Hafez', project: 'West Avenue', totalEgp: 3100000, paidEgp: 620000, installmentCount: 12 },
];

// Fixed terms shown for whichever plan is selected (authored once, reused for every plan in the prototype):
export const PAYMENT_PLAN_TERMS = [
  { label: 'Down payment', value: '20%' },
  { label: 'Installments', value: '{installmentCount} quarterly' }, // installmentCount interpolated per plan
  { label: 'Maintenance', value: '8% on delivery' },
  { label: 'Delivery', value: 'Q4 2026' },
  { label: 'Escalation', value: 'None' },
  { label: 'Discount applied', value: '2.0%' },
];

// Derivation formulas (pure functions of a PaymentPlanFixture), verbatim from the prototype:
//   pctPaid       = paidEgp / totalEgp * 100
//   progressBars  = round(pctPaid / 100 * 16)     // out of 16, rendered as filled/empty block glyphs
//   remainingEgp  = totalEgp - paidEgp
//
// 10-line installment schedule generated per plan (index i = 0..9), due dates are a FIXED shared
// calendar (not per-plan): ['11 Mar 2026','25 Mar 2026','25 Jun 2026','25 Sep 2026','25 Dec 2026',
// '25 Mar 2027','25 Jun 2027','25 Sep 2027','25 Dec 2027','25 Mar 2028']
//   label   = i===0 ? 'Deposit' : i===1 ? 'Down payment' : `Installment ${i-1}`
//   amount  = round(totalEgp * (i===0 ? 0.03 : i===1 ? 0.17 : 0.06))
//   isPaidByProgress = (paidEgp/totalEgp*100) > (i*8)
//   status  = isPaidByProgress ? 'Paid' : i === round(pctPaid/8)+1 ? 'Overdue' : 'Pending'
//   paidAmount = status === 'Paid' ? amount : 0
//
// Payment Plans list rows (planList) reuse the same array with: pct = round(paidEgp/totalEgp*100),
// totalLabel = `EGP ${(totalEgp/1_000_000).toFixed(2)}M`. Default selected plan in the prototype is
// unitId 'B-1204'.
