// Extracted verbatim from the design prototype's `NOTIFS` class field (notification bell dropdown).

export interface NotificationFixture {
  category: 'Approvals' | 'Sales' | 'Payments' | 'Leads' | 'AI';
  /** Key into icons.ts ICONS */
  icon: 'check' | 'clock' | 'alert' | 'lead' | 'spark' | 'payment';
  title: string;
  body: string;
  /** Relative age, e.g. "40m", "1h", "1d" */
  age: string;
  /** Action button label, or '' if none */
  actionLabel: string;
  /** Route the notification/action navigates to */
  targetRoute: string;
  /** Whether this notification is "unread"/highlighted by default */
  unread: boolean;
}

export const NOTIFICATIONS: NotificationFixture[] = [
  { category: 'Approvals', icon: 'check', title: 'Contract C-0191 awaiting approval', body: 'Hala Mostafa · Cedar C-0104 · EGP 6.10M — submitted by Sara Fathy 40 min ago.', age: '40m', actionLabel: 'Review contract', targetRoute: 'contracts', unread: true },
  { category: 'Sales', icon: 'clock', title: 'Reservation B-1204 expires in 24h', body: 'Tarek ElGohary · deposit EGP 145,500 not yet cleared.', age: '1h', actionLabel: 'Open reservation', targetRoute: 'reservations', unread: true },
  { category: 'Payments', icon: 'alert', title: 'Payment overdue — Ziad Hafez', body: 'WA-118 · EGP 465,000 overdue 112 days. Third escalation due.', age: '2h', actionLabel: 'Open account', targetRoute: 'outstanding', unread: true },
  { category: 'Leads', icon: 'lead', title: '6 new leads assigned to you', body: 'From the North Hills Q1 campaign — 2 scored above 85.', age: '3h', actionLabel: 'View leads', targetRoute: 'leads', unread: false },
  { category: 'AI', icon: 'spark', title: 'New AI insight · lead decay', body: '23 high-value leads have had no activity for more than 5 days.', age: '4h', actionLabel: 'Open Copilot', targetRoute: 'copilot', unread: true },
  { category: 'Approvals', icon: 'check', title: 'Workflow step requires you', body: 'Skyline Office Q2-26 price list — commercial approval.', age: '6h', actionLabel: 'Open approvals', targetRoute: 'approvals', unread: false },
  { category: 'Payments', icon: 'payment', title: 'EGP 412.8M collected this month', body: 'Collection rate 91.3%, up 1.8pp versus February.', age: '1d', actionLabel: '', targetRoute: 'collections', unread: false },
];

export const NOTIFICATION_TABS = ['All', 'Approvals', 'Sales', 'Payments', 'Leads', 'AI'];

// Derived: unread count badge = count of NOTIFICATIONS with unread === true while the "mark all read"
// action hasn't been triggered (4 of 7 above are unread) -> matches the prototype's hardcoded '4'.
// Icon/background tint per category: Payments -> bg #FBEDED / fg #9A3838; AI -> bg #EDF1FC / fg #1B4DB8;
// Approvals -> bg #E8F4EF / fg #1E7A5A; everything else (Sales, Leads) -> bg #F4F6FC / fg #3A5FA8.
