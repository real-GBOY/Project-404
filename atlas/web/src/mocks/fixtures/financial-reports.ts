// Extracted verbatim from the design prototype's "Financial Reports" table screen (TABLES().finreports).

export interface FinancialReportFixture {
  name: string;
  type: 'Collections' | 'Revenue' | 'Receivables' | 'Commissions' | 'Treasury';
  period: string;
  owner: string;
  schedule: string;
  lastRun: string;
  status: 'Active' | 'Draft';
}

export const FINANCIAL_REPORTS: FinancialReportFixture[] = [
  { name: 'Monthly Collections Summary', type: 'Collections', period: 'Feb 2026', owner: 'Finance Team', schedule: '1st of month', lastRun: '01 Mar 2026', status: 'Active' },
  { name: 'Revenue Recognition by Project', type: 'Revenue', period: 'Q1 2026', owner: 'Nadine Farid', schedule: 'Quarterly', lastRun: '01 Jan 2026', status: 'Active' },
  { name: 'Aging & Arrears Report', type: 'Receivables', period: 'Rolling 90d', owner: 'Finance Team', schedule: 'Weekly · Mon', lastRun: '09 Mar 2026', status: 'Active' },
  { name: 'Commission Payout Register', type: 'Commissions', period: 'Feb 2026', owner: 'Payroll', schedule: 'Monthly', lastRun: '05 Mar 2026', status: 'Active' },
  { name: 'Cash Flow Forecast', type: 'Treasury', period: 'Next 12m', owner: 'Nadine Farid', schedule: 'Manual', lastRun: '28 Feb 2026', status: 'Draft' },
];

// Screen KPIs (authored): Saved reports 24, Scheduled 11, Runs this month 86, Failed runs 0. Subtitle:
// "Scheduled and ad-hoc finance reporting · exports to XLSX and PDF" — FINANCIAL_REPORTS above is a
// 5-row sample of the 24 saved reports.
