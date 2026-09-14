// Extracted verbatim from the design prototype's dashboard insight cards (`insightDefs`) and the
// Insights/Recommendations feed (`feed`, inside `moreVals()` — serves both the /insights and /recos routes).

import { TONE_PAIRS } from "@/styles/colors";

export interface DashboardInsightFixture {
  key: string;
  tag: string;
  tagBg: string;
  tagFg: string;
  confidence: string;
  text: string;
  detail: string;
  cta: string;
  /** Route this insight's CTA navigates to, when applicable */
  targetRoute?: string;
}

// Dashboard "AI insights" panel (3 cards). Each is dismissible; 'decay' opens a confirm dialog instead
// of navigating (it creates 23 follow-up tasks rather than just linking somewhere).
export const DASHBOARD_INSIGHTS: DashboardInsightFixture[] = [
  {
    key: 'velocity', tag: 'Velocity', tagBg: TONE_PAIRS.success[0], tagFg: TONE_PAIRS.success[1], confidence: 'confidence 0.94',
    text: 'Sales velocity increased 18.4% this month.',
    detail: '14.2 units/week versus 12.0 in February. North Hills and Cedar Residences drive 71% of the lift; Skyline is flat.',
    cta: 'Open velocity report', targetRoute: 'an_sales',
  },
  {
    key: 'conversion', tag: 'Conversion', tagBg: TONE_PAIRS.brand[0], tagFg: TONE_PAIRS.brand[1], confidence: 'confidence 0.89',
    text: 'Building C has the highest conversion rate across the portfolio.',
    detail: '82% sell-through at 1.4pp above price-list average. Consider replicating the C floor mix in Palm District Building E.',
    cta: 'Compare buildings', targetRoute: 'buildings',
  },
  {
    key: 'decay', tag: 'Risk', tagBg: TONE_PAIRS.danger[0], tagFg: TONE_PAIRS.danger[1], confidence: 'confidence 0.97',
    text: '23 high-value leads have had no activity for more than 5 days.',
    detail: 'Combined pipeline value EGP 148M. 9 sit with agents already above target load — reassignment is recommended.',
    cta: 'Create 23 follow-up tasks',
    // action: opens a confirm dialog ("Create 23 follow-up tasks?") rather than navigating.
  },
];

// /insights and /recos feed (5 cards, shared data — only the page title/subtitle differ by route):
export interface InsightFeedItemFixture {
  tag: 'Risk' | 'Velocity' | 'Pricing' | 'Collections' | 'Inventory';
  tagBg: string;
  tagFg: string;
  title: string;
  body: string;
  cta: string;
  confidence: string;
}

export const INSIGHTS_FEED: InsightFeedItemFixture[] = [
  { tag: 'Risk', tagBg: TONE_PAIRS.danger[0], tagFg: TONE_PAIRS.danger[1], title: '23 high-value leads dormant for 5+ days', body: 'Combined pipeline value EGP 148M across 6 agents. Nine sit with agents already above target load.', cta: 'Create follow-up tasks for the assigned agents', confidence: 'confidence 0.97' },
  { tag: 'Velocity', tagBg: TONE_PAIRS.success[0], tagFg: TONE_PAIRS.success[1], title: 'Sales velocity up 18.4% month over month', body: 'North Hills and Cedar Residences contribute 71% of the lift. Skyline is flat at 6.2 units per week.', cta: 'Open sales analytics', confidence: 'confidence 0.94' },
  { tag: 'Pricing', tagBg: TONE_PAIRS.brand[0], tagFg: TONE_PAIRS.brand[1], title: 'Building C sells 1.4pp above price list', body: '82% sell-through with minimal discounting. The C floor mix is a candidate for Palm District Building E.', cta: 'Model the C mix for Building E', confidence: 'confidence 0.88' },
  { tag: 'Collections', tagBg: TONE_PAIRS.warning[0], tagFg: TONE_PAIRS.warning[1], title: 'EGP 14.2M has aged past 90 days', body: '12 accounts, 4 of them above EGP 1M. Skyline carries 32% of total arrears on 18% of contracts.', cta: 'Escalate the 4 largest accounts', confidence: 'confidence 0.96' },
  { tag: 'Inventory', tagBg: TONE_PAIRS.neutral[0], tagFg: TONE_PAIRS.neutral[1], title: '86 units have been listed longer than 120 days', body: 'Mostly penthouses in North Hills A and offices in Skyline. Absorption is 1.9% per month against 4.6% portfolio average.', cta: 'Review pricing for aged inventory', confidence: 'confidence 0.91' },
];
// Each feed item's CTA opens a confirm dialog: title = `${cta}?`, body = `${title}. ${body} Atlas will
// apply this action and record it in the audit log.`, confirm button label 'Run action'.

// Feed page copy: /insights subtitle "Generated every hour from sales, inventory, lead and payment
// data"; /recos subtitle "Actions Atlas proposes from live portfolio data · every action is reviewed
// before it runs".
