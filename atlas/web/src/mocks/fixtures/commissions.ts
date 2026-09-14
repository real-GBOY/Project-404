// Extracted verbatim from the design prototype's "Commissions" table screen (TABLES().commissions).

export interface CommissionFixture {
  agent: string;
  period: string;
  contracts: number;
  salesValue: string;
  /** Commission rate, e.g. "1.8%" */
  rate: string;
  commission: string;
  status: 'Paid' | 'Approved' | 'Pending';
}

export const COMMISSIONS: CommissionFixture[] = [
  { agent: 'Ahmed Mohamed', period: 'Feb 2026', contracts: 9, salesValue: 'EGP 52.4M', rate: '1.8%', commission: 'EGP 943,200', status: 'Paid' },
  { agent: 'Sara Fathy', period: 'Feb 2026', contracts: 8, salesValue: 'EGP 48.9M', rate: '1.8%', commission: 'EGP 880,200', status: 'Paid' },
  { agent: 'Youssef Hegazy', period: 'Feb 2026', contracts: 4, salesValue: 'EGP 61.2M', rate: '1.5%', commission: 'EGP 918,000', status: 'Approved' },
  { agent: 'Menna Kamal', period: 'Feb 2026', contracts: 6, salesValue: 'EGP 31.8M', rate: '1.8%', commission: 'EGP 572,400', status: 'Approved' },
  { agent: 'Mohamed Adel', period: 'Feb 2026', contracts: 5, salesValue: 'EGP 27.4M', rate: '1.8%', commission: 'EGP 493,200', status: 'Pending' },
  { agent: 'Nour ElSayed', period: 'Feb 2026', contracts: 3, salesValue: 'EGP 14.6M', rate: '1.8%', commission: 'EGP 262,800', status: 'Pending' },
  { agent: 'Kariman Osman', period: 'Feb 2026', contracts: 2, salesValue: 'EGP 6.2M', rate: '1.8%', commission: 'EGP 111,600', status: 'Pending' },
];

// Screen KPIs (authored): Accrued EGP 42.8M (+6.1%), Approved EGP 31.2M, Paid this month EGP 18.6M
// (+9.2%), Held EGP 4.1M. Each row's commission ~= salesValue * rate (e.g. Ahmed Mohamed: 52.4M * 1.8%
// = 943,200 — matches exactly; Youssef Hegazy: 61.2M * 1.5% = 918,000 — matches exactly), so `commission`
// can be recomputed as round(parseSalesValue(salesValue) * parseRate(rate)) rather than stored raw.
