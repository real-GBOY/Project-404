// Extracted verbatim from the design prototype's `baseActivity` array (inside `renderVals()`) — the
// dashboard's "recent activity" sidebar feed. This is a system-wide event log distinct from
// activities.ts (which is the CRM "Activities" table of calls/viewings/notes).

export interface ActivityFeedItemFixture {
  text: string;
  who: string;
  when: string;
  /** Marker color */
  color: string;
}

export const ACTIVITY_FEED: ActivityFeedItemFixture[] = [
  { text: 'Unit C-0311 moved Available → Reserved', who: 'Sara Fathy', when: '6 min ago', color: '#F0B429' },
  { text: 'Contract C-0193 approved and signed', who: 'Mohamed Adel', when: '22 min ago', color: '#3DBE8B' },
  { text: 'Installment 9/24 cleared · EGP 1,120,000', who: 'Finance Bot', when: '38 min ago', color: '#3DBE8B' },
  { text: 'Lead L-4821 qualified · score 92', who: 'Ahmed Mohamed', when: '1h ago', color: '#1B4DB8' },
  { text: 'Price list NH v4.2 published', who: 'Nadine Farid', when: '2h ago', color: '#1B4DB8' },
  { text: 'Reservation A-1102 expired without contract', who: 'System', when: '3h ago', color: '#C05555' },
  { text: '6 leads assigned from North Hills campaign', who: 'Routing engine', when: '4h ago', color: '#1B4DB8' },
  { text: 'Cedar 2 handover inspection scheduled', who: 'Operations', when: '5h ago', color: '#8A8A85' },
];

// At runtime the prototype prepends any "live" demo events (see toasts.ts LIVE_DEMO_EVENTS) to the
// front of this list; ACTIVITY_FEED above is the static/seed portion only.
