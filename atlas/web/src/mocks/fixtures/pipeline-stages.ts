// Extracted verbatim from the design prototype's `STAGES` class field, the `stageMeta` color map, and
// the extra pipeline-only leads (`extraPipe`) that appear on the Kanban pipeline board but not in the
// LEADS table (they represent further-along leads: Reserved/Contracted/Sold).

export const STAGES = [
  'NEW', 'QUALIFIED', 'CONTACTED', 'VIEWING', 'NEGOTIATION', 'RESERVED', 'CONTRACTED', 'SOLD', 'LOST',
] as const;

export type StageKey = (typeof STAGES)[number];

export const STAGE_COLORS: Record<StageKey, string> = {
  NEW: '#9FB4E4',
  QUALIFIED: '#7E9BDC',
  CONTACTED: '#5C80CF',
  VIEWING: '#E2B457',
  NEGOTIATION: '#D89A3C',
  RESERVED: '#1B4DB8',
  CONTRACTED: '#2E7D5B',
  SOLD: '#1E7A5A',
  LOST: '#C05555',
};

// stageOf(lead) default mapping from a LEADS row's `status` field to a pipeline stage, used when there
// is no manual drag-and-drop override for that lead:
export const LEAD_STATUS_TO_STAGE: Record<string, StageKey> = {
  New: 'NEW',
  Qualified: 'QUALIFIED',
  Contacted: 'CONTACTED',
  Viewing: 'VIEWING',
  Negotiation: 'NEGOTIATION',
  Lost: 'LOST',
};

// Pipeline-only leads further along the funnel than anything in LEADS (Reserved/Contracted/Sold),
// authored directly with an explicit stage rather than derived from `status`.
export interface PipelineOnlyLeadFixture {
  id: string;
  name: string;
  status: 'Reserved' | 'Contracted' | 'Sold';
  score: number;
  interest: string;
  value: string;
  agent: string;
  lastActivity: string;
  stage: StageKey;
}

export const PIPELINE_EXTRA_LEADS: PipelineOnlyLeadFixture[] = [
  { id: 'L-4740', name: 'Rania Ezzat', status: 'Reserved', score: 84, interest: 'North Hills · B-0604', value: 'EGP 4.6M', agent: 'Ahmed Mohamed', lastActivity: '1d ago', stage: 'RESERVED' },
  { id: 'L-4722', name: 'Mona Fahmy', status: 'Contracted', score: 91, interest: 'North Hills · A-0712', value: 'EGP 5.6M', agent: 'Mohamed Adel', lastActivity: '3d ago', stage: 'CONTRACTED' },
  { id: 'L-4701', name: 'Omar Shaker', status: 'Sold', score: 96, interest: 'Skyline · OFF-0904', value: 'EGP 11.2M', agent: 'Youssef Hegazy', lastActivity: '6d ago', stage: 'SOLD' },
];

// Derivation: the pipeline board's per-stage `value` total = sum of each item's numeric `value` (EGP
// millions, parsed from the "EGP X.XM" string) for items in that stage, formatted as "EGP {sum}M".
// The full pipeline board population = LEADS.concat(PIPELINE_EXTRA_LEADS), grouped by
// (manual stage override ?? LEAD_STATUS_TO_STAGE[status] ?? 'NEW').
// Dashboard/Deals-screen totals: "84 open deals" and "EGP 1.86B weighted pipeline" (pipeline total EGP
// 1.86B weighted · 84 open deals) are authored copy, not recomputed from this 15-lead sample.

// CRM funnel (dashboard) — authored funnel counts/rates by stage, NOT derived from LEADS/PIPELINE_EXTRA_LEADS above:
export interface FunnelStageFixture {
  label: string;
  count: string;
  /** conversion rate relative to the top of funnel, as a formatted percentage string */
  rate: string;
  /** rate as a plain 0-100 number for bar width */
  pct: number;
  color: string;
}

export const CRM_FUNNEL: FunnelStageFixture[] = [
  { label: 'New', count: '1,842', rate: '100%', pct: 100, color: '#9FB4E4' },
  { label: 'Qualified', count: '1,024', rate: '55.6%', pct: 56, color: '#7E9BDC' },
  { label: 'Viewing', count: '612', rate: '33.2%', pct: 33, color: '#5C80CF' },
  { label: 'Negotiation', count: '348', rate: '18.9%', pct: 19, color: '#3A65C3' },
  { label: 'Reserved', count: '278', rate: '15.1%', pct: 15, color: '#1B4DB8' },
  { label: 'Contracted', count: '217', rate: '11.8%', pct: 12, color: '#12357F' },
];
