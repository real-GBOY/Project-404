// Extracted verbatim from the design prototype's scripted "live" demo events, fired from
// `componentDidMount()` via setTimeout to simulate real-time activity (a toast notification + an
// activity-feed prepend). There is no other authored toast content in the prototype — these two are it.

export interface LiveDemoEventFixture {
  kind: 'Reservation' | 'Payment';
  /** Toast accent color */
  color: string;
  title: string;
  body: string;
  /** Milliseconds after mount that this event fires, in the prototype's scripted demo */
  fireAfterMs: number;
  /** Optional CTA button label on the toast */
  actionLabel?: string;
  /** Route the toast/action navigates to (defaults to 'dashboard' if omitted) */
  targetRoute?: string;
}

export const LIVE_DEMO_EVENTS: LiveDemoEventFixture[] = [
  {
    kind: 'Reservation', color: '#F0B429', title: 'UNIT B-1204 · RESERVED',
    body: 'Ahmed Mohamed reserved B-1204 for Tarek ElGohary — deposit EGP 145,500 pending.',
    fireAfterMs: 5200, actionLabel: 'Open unit', targetRoute: 'units',
    // also sets a unit status override: unitOverrides['B-1204'] = 'Reserved' (see units.ts unitAt()).
  },
  {
    kind: 'Payment', color: '#3DBE8B', title: 'EGP 340,000 collected',
    body: 'Installment 7/20 cleared for Hala Mostafa · Cedar C-0311.',
    fireAfterMs: 13000,
  },
];

// Toast lifecycle formula: each toast auto-dismisses 11000ms after it appears. When a toast/action fires
// it is also prepended to activity-feed.ts's list as `{ text: title + ' — ' + body, who: kind, when:
// 'just now', color }`.

// Generic "action completed" toast template (fired after confirming any confirm-dialog action elsewhere
// in the app): { kind: 'Action', color: '#3DBE8B', title: 'Action completed', body: `${confirmCta} applied
// and written to the audit log.` }
