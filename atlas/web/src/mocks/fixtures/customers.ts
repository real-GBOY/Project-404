// Extracted verbatim from the design prototype's `CUSTOMERS` class field, plus the customer-detail
// data built by `detailVals()` for the single "selected" customer shown on the Customer 360 screen.

import { TOKEN_COLORS } from "@/styles/colors";

export interface CustomerFixture {
  id: string;
  name: string;
  email: string;
  phone: string;
  primaryProject: string;
  unitsOwned: number;
  /** Formatted portfolio value, e.g. "EGP 11.2M" */
  portfolioValue: string;
  /** Formatted amount collected to date, e.g. "EGP 3.4M" */
  collected: string;
  agent: string;
  status: 'Active' | 'Pending';
}

export const CUSTOMERS: CustomerFixture[] = [
  { id: 'c1', name: 'Karim Abdelrahman', email: 'karim.abdelrahman@gmail.com', phone: '+20 100 244 8713', primaryProject: 'North Hills', unitsOwned: 2, portfolioValue: 'EGP 11.2M', collected: 'EGP 3.4M', agent: 'Ahmed Mohamed', status: 'Active' },
  { id: 'c2', name: 'Hala Mostafa', email: 'h.mostafa@outlook.com', phone: '+20 122 887 4410', primaryProject: 'Cedar Residences', unitsOwned: 1, portfolioValue: 'EGP 7.8M', collected: 'EGP 5.1M', agent: 'Sara Fathy', status: 'Active' },
  { id: 'c3', name: 'Tarek ElGohary', email: 'tarek.gohary@ymail.com', phone: '+20 111 903 2287', primaryProject: 'North Hills', unitsOwned: 1, portfolioValue: 'EGP 4.85M', collected: 'EGP 3.4M', agent: 'Ahmed Mohamed', status: 'Active' },
  { id: 'c4', name: 'Omar Shaker', email: 'o.shaker@shakerco.eg', phone: '+20 106 772 1145', primaryProject: 'Skyline Business Park', unitsOwned: 3, portfolioValue: 'EGP 34.6M', collected: 'EGP 12.8M', agent: 'Youssef Hegazy', status: 'Active' },
  { id: 'c5', name: 'Dina Nabil', email: 'dina.nabil@gmail.com', phone: '+20 109 331 5580', primaryProject: 'Cedar Residences', unitsOwned: 1, portfolioValue: 'EGP 6.9M', collected: 'EGP 0.0M', agent: 'Menna Kamal', status: 'Pending' },
  { id: 'c6', name: 'Sherif Zaki', email: 'sherif.zaki@zakigroup.com', phone: '+20 112 448 9917', primaryProject: 'Palm District', unitsOwned: 2, portfolioValue: 'EGP 16.4M', collected: 'EGP 9.2M', agent: 'Sara Fathy', status: 'Active' },
  { id: 'c7', name: 'Mona Fahmy', email: 'mona.fahmy@gmail.com', phone: '+20 101 774 2093', primaryProject: 'North Hills', unitsOwned: 1, portfolioValue: 'EGP 5.6M', collected: 'EGP 5.6M', agent: 'Mohamed Adel', status: 'Active' },
  { id: 'c8', name: 'Ziad Hafez', email: 'ziad.hafez@hafezmed.com', phone: '+20 127 009 5518', primaryProject: 'West Avenue', unitsOwned: 1, portfolioValue: 'EGP 3.1M', collected: 'EGP 0.6M', agent: 'Kariman Osman', status: 'Active' },
];

// Screen KPIs (authored): Customers 486 (+14), Active contracts 312 (+9), Lifetime value EGP 2.84B
// (+4.1%), Avg. units / customer 1.4. Subtitle: "486 customers · 312 with active contracts · EGP 2.84B
// lifetime value" — CUSTOMERS above is an 8-row sample of that larger dataset.

// ---------- Customer 360 detail (authored only for customer c1 / Karim Abdelrahman in the prototype) ----------

export interface CustomerOwnedUnitFixture {
  unitId: string;
  location: string;
  spec: string;
  price: string;
  status: 'Sold' | 'Reserved';
}

export interface CustomerPaymentFixture {
  ref: string;
  label: string;
  date: string;
  amount: string;
  status: 'Paid' | 'Pending';
}

export interface CustomerContractFixture {
  id: string;
  unitId: string;
  value: string;
  signed: string;
  status: 'Signed' | 'Draft';
}

export interface CustomerDocumentFixture {
  name: string;
  size: string;
  status: 'Verified' | 'Pending';
}

export interface CustomerTimelineEntryFixture {
  kind: string;
  text: string;
  when: string;
  /** hex color used for the timeline marker */
  color: string;
}

export const CUSTOMER_DETAIL_C1 = {
  customerId: 'c1',
  since: 'Customer since Aug 2024',
  nationalId: '2 8704 1102 34517',
  address: 'Villa 42, Street 90, New Cairo',
  // kpis[2] ("Outstanding": EGP 7.8M) and kpis[4] ("Open contracts": 2) are authored directly here and
  // are not recomputed from portfolioValue/collected on the CUSTOMERS row above.
  kpis: [
    { label: 'Portfolio value', value: 'EGP 11.2M' },
    { label: 'Collected', value: 'EGP 3.4M' },
    { label: 'Outstanding', value: 'EGP 7.8M' },
    { label: 'Units owned', value: '2' },
    { label: 'Open contracts', value: '2' },
    { label: 'On-time payments', value: '92%', delta: '+4pp' },
  ],
  ownedUnits: [
    { unitId: 'A-0508', location: 'North Hills · Building A · Floor 5', spec: '3-Bed · 186 m²', price: 'EGP 5,800,000', status: 'Sold' },
    { unitId: 'B-1204', location: 'North Hills · Building B · Floor 12', spec: '3-Bed · 178 m²', price: 'EGP 4,850,000', status: 'Reserved' },
  ] satisfies CustomerOwnedUnitFixture[],
  payments: [
    { ref: 'PM-88191', label: 'Installment 5 / 16', date: '08 Mar 2026', amount: 'EGP 290,000', status: 'Paid' },
    { ref: 'PM-88104', label: 'Installment 4 / 16', date: '08 Dec 2025', amount: 'EGP 290,000', status: 'Paid' },
    { ref: 'PM-88012', label: 'Down payment', date: '12 Sep 2025', amount: 'EGP 696,000', status: 'Paid' },
    { ref: 'PM-87980', label: 'Reservation deposit', date: '28 Aug 2025', amount: 'EGP 174,000', status: 'Paid' },
    { ref: 'INS-6 / 16', label: 'Installment 6 / 16', date: '08 Jun 2026', amount: 'EGP 290,000', status: 'Pending' },
  ] satisfies CustomerPaymentFixture[],
  contracts: [
    { id: 'C-0189', unitId: 'A-0508', value: 'EGP 5,800,000', signed: '21 Feb 2026', status: 'Signed' },
    { id: 'C-0201', unitId: 'B-1204', value: 'EGP 4,850,000', signed: '—', status: 'Draft' },
  ] satisfies CustomerContractFixture[],
  documents: [
    { name: 'National ID.pdf', size: '1.1 MB', status: 'Verified' },
    { name: 'Contract C-0189 signed.pdf', size: '2.4 MB', status: 'Verified' },
    { name: 'Payment plan A-0508.pdf', size: '186 KB', status: 'Verified' },
    { name: 'Proof of income.pdf', size: '640 KB', status: 'Pending' },
  ] satisfies CustomerDocumentFixture[],
  timeline: [
    { kind: 'Reservation', text: 'B-1204 reserved · deposit EGP 145,500 pending', when: '11 Mar 2026 · 14:42', color: TOKEN_COLORS.warning.warningSolid },
    { kind: 'Payment', text: 'Installment 5 / 16 received · EGP 290,000', when: '08 Mar 2026 · 10:02', color: TOKEN_COLORS.success.successStrong },
    { kind: 'Call', text: 'Discussed upgrade to Building C penthouse', when: '02 Mar 2026 · 16:20', color: TOKEN_COLORS.brand.primary },
    { kind: 'Contract', text: 'C-0189 signed for A-0508', when: '21 Feb 2026 · 12:00', color: TOKEN_COLORS.success.successStrong },
    { kind: 'Note', text: 'Prefers Q4 2026 handover; second home buyer', when: '18 Feb 2026 · 09:40', color: TOKEN_COLORS.text.muted },
  ] satisfies CustomerTimelineEntryFixture[],
  tabs: ['Overview', 'Units', 'Payments', 'Contracts', 'Documents', 'Activity'],
};

// GAP: the prototype only ever renders this detail view for the currently-selected customer id in
// state (default 'c1'); no equivalent detail data was authored for c2..c8. The real app will need to
// author (or generate) detail records for the other 7 customers.
