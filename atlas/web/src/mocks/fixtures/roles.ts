// Extracted verbatim from the design prototype's "Roles & Permissions" table screen (TABLES().roles).

export interface RoleFixture {
  name: string;
  users: number;
  dataScope: string;
  /** Discount authority percentage, or "—" if none */
  discountAuthority: string;
  canApprove: string;
  status: 'Active';
}

export const ROLES: RoleFixture[] = [
  { name: 'Administrator', users: 3, dataScope: 'Organisation-wide', discountAuthority: '—', canApprove: 'All approvals', status: 'Active' },
  { name: 'Commercial Director', users: 2, dataScope: 'Organisation-wide', discountAuthority: '10.0%', canApprove: 'Contracts, pricing, payouts', status: 'Active' },
  { name: 'Sales Manager', users: 5, dataScope: 'Own team', discountAuthority: '6.0%', canApprove: 'Reservations, contracts', status: 'Active' },
  { name: 'Senior Sales Agent', users: 8, dataScope: 'Own leads & units', discountAuthority: '2.0%', canApprove: '—', status: 'Active' },
  { name: 'Finance Controller', users: 4, dataScope: 'Finance modules', discountAuthority: '—', canApprove: 'Payments, plans, payouts', status: 'Active' },
  { name: 'Read-only Auditor', users: 2, dataScope: 'Organisation-wide', discountAuthority: '—', canApprove: '—', status: 'Active' },
];

// Screen KPIs (authored): Roles 6, Custom roles 2, Users assigned 38, Escalation rules 9. Subtitle:
// "6 roles · granular permissions across 14 modules with approval thresholds". Sum of ROLES[].users =
// 3+2+5+8+4+2 = 24, which does not reconcile with the "Users assigned 38" KPI (a role/headcount gap in
// the source data — Team screen also implies 38 total users).
