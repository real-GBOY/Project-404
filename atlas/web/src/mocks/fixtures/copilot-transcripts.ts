// Extracted verbatim from the design prototype's AI Copilot chat data: the seeded initial conversation
// (`chat` default in `moreVals()`), the canned suggestion chips, the chat history sidebar, and the
// keyword-matched canned answers used by `ask(q)` when the user submits a new question.

export interface ChatStatFixture {
  label: string;
  value: string;
  delta: string;
}

export interface ChatRowFixture {
  name: string;
  value: string;
  meta: string;
}

export interface ChatTurnFixture {
  role: 'user' | 'ai';
  text: string;
  /** true for the "action recommendation" style AI message (dormant leads insight) */
  isAction?: boolean;
  detail?: string;
  recommend?: string;
  stats?: ChatStatFixture[];
  rows?: ChatRowFixture[];
  cites?: string[];
  /** Suggested follow-up questions rendered as chips under this AI message */
  follow?: string[];
}

// Seeded conversation shown by default when the Copilot screen first loads.
export const COPILOT_INITIAL_TRANSCRIPT: ChatTurnFixture[] = [
  { role: 'user', text: 'How are sales performing this month?' },
  {
    role: 'ai',
    text: 'February closed at EGP 412.8M contracted across 58 units — 11.2% above January and the strongest month in the trailing twelve. Velocity is 14.2 units per week, up 18.4%.',
    stats: [
      { label: 'Revenue MTD', value: 'EGP 412.8M', delta: '+11.2%' },
      { label: 'Units sold', value: '58', delta: '+11' },
      { label: 'Velocity', value: '14.2 u/wk', delta: '+18.4%' },
      { label: 'Avg. deal', value: 'EGP 6.2M', delta: '+4.0%' },
    ],
    rows: [
      { name: 'North Hills', value: 'EGP 168.4M', meta: '24 units' },
      { name: 'Cedar Residences', value: 'EGP 96.2M', meta: '14 units' },
      { name: 'Palm District', value: 'EGP 88.1M', meta: '12 units' },
      { name: 'Skyline Business Park', value: 'EGP 44.6M', meta: '5 units' },
      { name: 'West Avenue', value: 'EGP 15.5M', meta: '3 units' },
    ],
    cites: ['sales_orders · 58 rows', 'payments · 214 rows', 'units · 1,286 rows'],
    follow: ['Which projects have the highest sales velocity?', 'Which agents are underperforming?', 'How much revenue is currently outstanding?'],
  },
  {
    role: 'ai',
    isAction: true,
    text: '23 high-value leads have had no activity for more than 5 days.',
    detail: 'Combined pipeline value EGP 148M. The longest gap is 11 days (Hossam Adly, EGP 15.2M). Nine leads belong to agents already above target load.',
    recommend: 'Create follow-up tasks for the assigned agents, due within 24 hours, and queue the nine overloaded leads for reassignment review.',
    cites: ['leads · 23 rows', 'activities · last 14 days', 'users · load index'],
  },
];

// Suggestion chips shown above the chat input.
export const COPILOT_SUGGESTIONS: string[] = [
  'Which projects have the highest sales velocity?',
  'Show me the units most likely to sell soon.',
  "Which high-value leads haven’t been contacted recently?",
  'How much revenue is currently outstanding?',
  "Summarise Karim Abdelrahman’s history.",
];

// Chat history sidebar (grouped by day; items are titles only — no transcripts were authored for them).
export const COPILOT_HISTORY: { label: string; items: string[] }[] = [
  { label: 'Today', items: ['Sales performance this month', 'Dormant high-value leads', 'Skyline absorption forecast'] },
  { label: 'Yesterday', items: ['Agent conversion comparison', 'Outstanding by aging bucket'] },
  { label: 'Last week', items: ['Cedar handover readiness', 'Commission accrual check', 'North Hills price sensitivity'] },
];

// Canned answers keyed by topic, matched against the user's typed question via keyword search in
// ask(q): 'velocit' -> velocity, 'outstand'|'revenue' -> outstanding, 'agent'|'underperf' ->
// underperforming, 'likely'|'unit' -> likely, 'summar'|'histor' -> summar. Falls back to 'velocity' if
// no keyword matches.
export interface CannedAnswerFixture {
  text: string;
  stats?: ChatStatFixture[];
  rows: ChatRowFixture[];
  cites: string[];
  follow: string[];
}

export const COPILOT_CANNED_ANSWERS: Record<'velocity' | 'outstanding' | 'underperforming' | 'likely' | 'summar', CannedAnswerFixture> = {
  velocity: {
    text: 'Cedar Residences leads at 9.6 units per week against 218 total units — an absorption rate of 4.4% per month. North Hills is highest in absolute terms at 18.4 units per week.',
    rows: [
      { name: 'Cedar Residences', value: '9.6 u/wk', meta: '4.4%/mo' },
      { name: 'North Hills', value: '18.4 u/wk', meta: '4.5%/mo' },
      { name: 'Palm District', value: '12.1 u/wk', meta: '3.6%/mo' },
      { name: 'Skyline Business Park', value: '6.2 u/wk', meta: '3.4%/mo' },
      { name: 'West Avenue', value: '4.8 u/wk', meta: '3.5%/mo' },
    ],
    cites: ['sales_orders · trailing 90 days', 'units · 1,286 rows'],
    follow: ['Why is Skyline slower?', 'Forecast North Hills sell-out date'],
  },
  outstanding: {
    text: 'EGP 42.6M is outstanding across 128 accounts. EGP 14.2M has aged past 90 days, concentrated in Skyline Business Park.',
    stats: [
      { label: 'Total overdue', value: 'EGP 42.6M', delta: '+4.2%' },
      { label: '90+ days', value: 'EGP 14.2M', delta: '' },
      { label: 'Accounts', value: '128', delta: '+11' },
      { label: 'Collection rate', value: '91.3%', delta: '+1.8pp' },
    ],
    rows: [
      { name: 'Skyline Business Park', value: 'EGP 13.7M', meta: '24 accounts' },
      { name: 'Palm District', value: 'EGP 11.4M', meta: '33 accounts' },
      { name: 'North Hills', value: 'EGP 9.5M', meta: '41 accounts' },
      { name: 'West Avenue', value: 'EGP 4.2M', meta: '12 accounts' },
      { name: 'Cedar Residences', value: 'EGP 3.8M', meta: '18 accounts' },
    ],
    cites: ['installments · 2,184 rows', 'payments · 2,061 rows'],
    follow: ['Escalate the 90+ day accounts', 'Show collection trend by project'],
  },
  underperforming: {
    text: 'Two agents are below both conversion and follow-up thresholds. Nour ElSayed converts at 3.1% with 58% follow-up compliance; Kariman Osman at 2.7% and 41%.',
    rows: [
      { name: 'Nour ElSayed', value: '3.1% conv.', meta: '58% follow-up' },
      { name: 'Kariman Osman', value: '2.7% conv.', meta: '41% follow-up' },
      { name: 'Team average', value: '4.7% conv.', meta: '76% follow-up' },
    ],
    cites: ['users · 19 agents', 'activities · last 30 days'],
    follow: ['Reassign their dormant leads', 'Open agent performance'],
  },
  likely: {
    text: '34 units carry a high propensity score this quarter, led by three-bedroom units on floors 8–12 in North Hills Building C where sell-through is 82%.',
    rows: [
      { name: 'C-0904 · 3-Bed · 186 m²', value: 'EGP 6.9M', meta: 'score 0.91' },
      { name: 'C-1102 · 3-Bed · 178 m²', value: 'EGP 6.7M', meta: 'score 0.89' },
      { name: 'A-0708 · 2-Bed · 132 m²', value: 'EGP 4.6M', meta: 'score 0.86' },
      { name: 'C2-0403 · Villa · 246 m²', value: 'EGP 18.4M', meta: 'score 0.84' },
    ],
    cites: ['units · propensity model v3', 'leads · interest overlap'],
    follow: ['Assign these units to active leads', 'Open inventory analytics'],
  },
  summar: {
    text: 'Karim Abdelrahman has been a customer since August 2024. Two units, EGP 11.2M portfolio value, EGP 3.4M collected, 92% on-time payments. B-1204 was reserved today and the deposit is pending.',
    stats: [
      { label: 'Portfolio', value: 'EGP 11.2M', delta: '' },
      { label: 'Collected', value: 'EGP 3.4M', delta: '' },
      { label: 'On-time', value: '92%', delta: '+4pp' },
      { label: 'Units', value: '2', delta: '' },
    ],
    rows: [
      { name: 'A-0508 · North Hills', value: 'EGP 5.8M', meta: 'Sold' },
      { name: 'B-1204 · North Hills', value: 'EGP 4.85M', meta: 'Reserved' },
    ],
    cites: ['customers · CU-0001', 'payments · 5 rows', 'contracts · 2 rows'],
    follow: ['Draft a payment reminder', 'Open customer profile'],
  },
};
