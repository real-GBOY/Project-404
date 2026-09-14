// Extracted verbatim from the design prototype's "Installments" table screen (TABLES().installments).

export interface InstallmentFixture {
  /** e.g. "INS-4 / 16" = installment 4 of 16 */
  label: string;
  customer: string;
  unit: string;
  dueDate: string;
  amount: string;
  paid: string;
  status: 'Pending' | 'Overdue' | 'Paid' | 'Partial';
}

export const INSTALLMENTS: InstallmentFixture[] = [
  { label: 'INS-4 / 16', customer: 'Tarek ElGohary', unit: 'B-1204', dueDate: '15 Mar 2026', amount: 'EGP 242,500', paid: 'EGP 0', status: 'Pending' },
  { label: 'INS-7 / 20', customer: 'Hala Mostafa', unit: 'C-0311', dueDate: '20 Mar 2026', amount: 'EGP 340,000', paid: 'EGP 0', status: 'Pending' },
  { label: 'INS-3 / 12', customer: 'Ziad Hafez', unit: 'WA-118', dueDate: '28 Feb 2026', amount: 'EGP 155,000', paid: 'EGP 0', status: 'Overdue' },
  { label: 'INS-9 / 24', customer: 'Omar Shaker', unit: 'OFF-0904', dueDate: '01 Mar 2026', amount: 'EGP 1,120,000', paid: 'EGP 1,120,000', status: 'Paid' },
  { label: 'INS-5 / 16', customer: 'Karim Abdelrahman', unit: 'A-0508', dueDate: '05 Mar 2026', amount: 'EGP 290,000', paid: 'EGP 290,000', status: 'Paid' },
  { label: 'INS-2 / 16', customer: 'Dina Nabil', unit: 'C-0208', dueDate: '18 Feb 2026', amount: 'EGP 207,000', paid: 'EGP 100,000', status: 'Partial' },
  { label: 'INS-11 / 20', customer: 'Sherif Zaki', unit: 'D-0705', dueDate: '25 Mar 2026', amount: 'EGP 390,000', paid: 'EGP 0', status: 'Pending' },
];

// Screen KPIs (authored): Due next 30d EGP 318.4M, Overdue EGP 42.6M (+4.2%), Paid this quarter EGP
// 1.14B (+8.1%), Plans active 312 (+9). Subtitle: "All scheduled installment lines across 312 active
// payment plans" — INSTALLMENTS above is a 7-row sample of that larger dataset.
