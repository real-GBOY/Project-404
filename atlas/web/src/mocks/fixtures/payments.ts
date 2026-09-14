// Extracted verbatim from the design prototype's "Payments" table screen (TABLES().payments).

export interface PaymentFixture {
  reference: string;
  customer: string;
  unit: string;
  amount: string;
  method: 'Bank transfer' | 'Cheque' | 'Instapay' | 'Card';
  date: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

export const PAYMENTS: PaymentFixture[] = [
  { reference: 'PM-88214', customer: 'Hala Mostafa', unit: 'C-0311', amount: 'EGP 340,000', method: 'Bank transfer', date: '11 Mar 2026', status: 'Paid' },
  { reference: 'PM-88209', customer: 'Mona Fahmy', unit: 'A-0712', amount: 'EGP 186,000', method: 'Cheque', date: '10 Mar 2026', status: 'Paid' },
  { reference: 'PM-88204', customer: 'Omar Shaker', unit: 'OFF-0904', amount: 'EGP 1,120,000', method: 'Bank transfer', date: '10 Mar 2026', status: 'Paid' },
  { reference: 'PM-88198', customer: 'Sherif Zaki', unit: 'D-0705', amount: 'EGP 390,000', method: 'Instapay', date: '09 Mar 2026', status: 'Pending' },
  { reference: 'PM-88191', customer: 'Karim Abdelrahman', unit: 'A-0508', amount: 'EGP 290,000', method: 'Bank transfer', date: '08 Mar 2026', status: 'Paid' },
  { reference: 'PM-88186', customer: 'Ziad Hafez', unit: 'WA-118', amount: 'EGP 155,000', method: 'Cheque', date: '07 Mar 2026', status: 'Overdue' },
  { reference: 'PM-88180', customer: 'Tarek ElGohary', unit: 'B-1204', amount: 'EGP 145,500', method: 'Card', date: '06 Mar 2026', status: 'Paid' },
];

// Screen KPIs (authored): Collected MTD EGP 412.8M (+11.2%), Cleared 2,061, Pending clearance 84, Failed
// / bounced 39 (+4). Subtitle: "2,184 payments recorded · EGP 6.42B collected to date · 91.3% collection
// rate" — PAYMENTS above is a 7-row sample of that larger dataset. See customers.ts
// CUSTOMER_DETAIL_C1.payments for the per-customer payment history variant of this same concept.
