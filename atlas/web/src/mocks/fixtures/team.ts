// Extracted verbatim from the design prototype's `AGENTS` class field (the roster of sales-agent names
// referenced throughout leads/customers/deals/etc.) and the "Team" table screen (TABLES().team).

// Canonical agent name roster used across LEADS, CUSTOMERS, deals, commissions, etc.
export const AGENTS: string[] = ['Ahmed Mohamed', 'Sara Fathy', 'Mohamed Adel', 'Nour ElSayed', 'Youssef Hegazy', 'Menna Kamal', 'Kariman Osman'];

export interface TeamMemberFixture {
  name: string;
  email: string;
  role: string;
  team: string;
  assignedLeads: number;
  /** Formatted sales figure this month, or "—" for non-sales roles */
  salesMtd: string;
  lastActive: string;
  status: 'Active' | 'Pending';
}

export const TEAM: TeamMemberFixture[] = [
  { name: 'Ahmed Mohamed', email: 'ahmed.m@atlas.eg', role: 'Senior Sales Agent', team: 'North Cairo', assignedLeads: 48, salesMtd: 'EGP 52.4M', lastActive: '3 min ago', status: 'Active' },
  { name: 'Sara Fathy', email: 'sara.f@atlas.eg', role: 'Senior Sales Agent', team: 'West Cairo', assignedLeads: 44, salesMtd: 'EGP 48.9M', lastActive: '12 min ago', status: 'Active' },
  { name: 'Youssef Hegazy', email: 'youssef.h@atlas.eg', role: 'Commercial Sales Lead', team: 'Commercial', assignedLeads: 31, salesMtd: 'EGP 61.2M', lastActive: '1h ago', status: 'Active' },
  { name: 'Menna Kamal', email: 'menna.k@atlas.eg', role: 'Sales Agent', team: 'West Cairo', assignedLeads: 39, salesMtd: 'EGP 31.8M', lastActive: '26 min ago', status: 'Active' },
  { name: 'Mohamed Adel', email: 'mohamed.a@atlas.eg', role: 'Sales Manager', team: 'North Cairo', assignedLeads: 12, salesMtd: 'EGP 27.4M', lastActive: '8 min ago', status: 'Active' },
  { name: 'Nadine Farid', email: 'nadine.f@atlas.eg', role: 'Finance Controller', team: 'Finance', assignedLeads: 0, salesMtd: '—', lastActive: '40 min ago', status: 'Active' },
  { name: 'Kariman Osman', email: 'kariman.o@atlas.eg', role: 'Junior Sales Agent', team: 'Mostakbal', assignedLeads: 27, salesMtd: 'EGP 6.2M', lastActive: '2d ago', status: 'Pending' },
];

// Screen KPIs (authored): Users 38 (+3), Sales agents 19, Pending invites 2, MFA coverage 100%.
// Subtitle: "38 users · 6 roles · SSO enforced through Microsoft Entra ID" — TEAM above is a 7-row
// sample of the full 38-user roster (Nour ElSayed from AGENTS is notably absent from this table sample).
