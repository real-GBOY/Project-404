// Extracted verbatim from the design prototype's approval queue (`approvals`, inside `moreVals()`) used
// by the /approvals route.

export interface ApprovalFixture {
  kind: 'Contract approval' | 'Discount approval' | 'Price list approval' | 'Reservation extension' | 'Commission payout' | 'Refund request' | 'Plan restructure';
  subject: string;
  /** Formatted amount or impact description */
  amount: string;
  who: string;
  /** e.g. "Step 4 of 5" */
  step: string;
  age: string;
  status: 'Awaiting Approval' | 'Escalated';
}

export const APPROVALS: ApprovalFixture[] = [
  { kind: 'Contract approval', subject: 'C-0191 · Hala Mostafa · Cedar C-0104', amount: 'EGP 6.10M', who: 'Sara Fathy', step: 'Step 4 of 5', age: '40 min', status: 'Awaiting Approval' },
  { kind: 'Discount approval', subject: 'Deal D-2291 · 4% on B-1204', amount: 'EGP 194,000 impact', who: 'Ahmed Mohamed', step: 'Step 2 of 3', age: '2h', status: 'Awaiting Approval' },
  { kind: 'Price list approval', subject: 'Skyline Office Q2-26 · v1.6', amount: 'EGP 61,200 / m²', who: 'Nadine Farid', step: 'Step 2 of 2', age: '6h', status: 'Awaiting Approval' },
  { kind: 'Reservation extension', subject: 'A-1102 · Mahmoud Fawzy · +7 days', amount: 'EGP 153,000 deposit', who: 'Mohamed Adel', step: 'Step 1 of 2', age: '1d', status: 'Escalated' },
  { kind: 'Commission payout', subject: 'Feb 2026 · 7 agents', amount: 'EGP 4.18M', who: 'Payroll', step: 'Step 3 of 3', age: '1d', status: 'Awaiting Approval' },
  { kind: 'Refund request', subject: 'WA-204 · Ziad Hafez', amount: 'EGP 93,000', who: 'Kariman Osman', step: 'Step 1 of 3', age: '2d', status: 'Escalated' },
  { kind: 'Plan restructure', subject: 'CU-0114 · 24 → 30 installments', amount: 'EGP 2.24M arrears', who: 'Collections', step: 'Step 2 of 4', age: '3d', status: 'Awaiting Approval' },
];

// Matches the NAV badge count (Approvals: 7) and the screen subtitle "7 approvals pending · 2 escalated
// past SLA" exactly: 7 rows above, 2 of them status 'Escalated'.
