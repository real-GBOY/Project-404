// Extracted verbatim from the design prototype's "Audit Logs" table screen (TABLES().audit).

export interface AuditLogEntryFixture {
  timestamp: string;
  user: string;
  action: string;
  entity: string;
  before: string;
  after: string;
  source: 'Web' | 'API' | 'Mobile';
}

export const AUDIT_LOG: AuditLogEntryFixture[] = [
  { timestamp: '11 Mar 14:42:08', user: 'Ahmed Mohamed', action: 'Reserved', entity: 'Unit B-1204', before: 'Available', after: 'Reserved', source: 'Web' },
  { timestamp: '11 Mar 14:38:51', user: 'Sara Fathy', action: 'In Progress', entity: 'Payment plan CU-1042', before: '16 installments', after: '20 installments', source: 'Web' },
  { timestamp: '11 Mar 13:20:14', user: 'Mohamed Adel', action: 'Approved', entity: 'Contract C-0193', before: 'Awaiting Approval', after: 'Signed', source: 'Web' },
  { timestamp: '11 Mar 12:04:33', user: 'Finance Bot', action: 'Paid', entity: 'Installment INS-9 / 24', before: 'Pending', after: 'Paid', source: 'API' },
  { timestamp: '11 Mar 11:12:07', user: 'Nadine Farid', action: 'In Progress', entity: 'Price list NH v4.1', before: 'EGP 56,400 / m²', after: 'EGP 58,200 / m²', source: 'Web' },
  { timestamp: '11 Mar 10:48:19', user: 'Mostafa Halim', action: 'Approved', entity: 'Role · Sales Manager', before: 'Discount ≤ 4%', after: 'Discount ≤ 6%', source: 'Web' },
  { timestamp: '11 Mar 09:31:55', user: 'Youssef Hegazy', action: 'Lost', entity: 'Lead L-4775', before: 'Negotiation', after: 'Lost', source: 'Mobile' },
];

// Screen KPIs (authored): Entries today 1,284, Users active 38, Permission changes 2, Retention 7 years.
// Subtitle: "Immutable record of every state change · retained 7 years · exportable for compliance" —
// AUDIT_LOG above is a 7-row sample of the 1,284 entries logged today. Note 'Mostafa Halim' appears here
// as an actor but not in team.ts TEAM (a 7-row sample of a larger 38-user roster) — not necessarily an
// inconsistency given TEAM is itself only a sample, but worth flagging when materializing the full roster.
