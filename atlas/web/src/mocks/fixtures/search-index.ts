// Extracted verbatim from the design prototype's command-palette search index (`idx`, inside
// `renderVals()`) — a small curated cross-entity index used for the Cmd+K global search demo. This is
// a distinct, separately-authored sample; it does not necessarily reference the exact same rows found
// in the domain-specific fixtures (e.g. it uses 'CU-0001' while customers.ts uses id 'c1').

export interface SearchIndexItemFixture {
  title: string;
  subtitle: string;
  meta: string;
  /** Route this result navigates to */
  targetRoute: string;
}

export interface SearchIndexGroupFixture {
  group: 'Units' | 'Customers' | 'Leads' | 'Projects' | 'Contracts & Payments' | 'Documents';
  items: SearchIndexItemFixture[];
}

export const SEARCH_INDEX: SearchIndexGroupFixture[] = [
  {
    group: 'Units',
    items: [
      { title: 'B-1204', subtitle: 'North Hills · Building B · Floor 12 · 3-Bed', meta: 'Reserved', targetRoute: 'units' },
      { title: 'A-0904', subtitle: 'North Hills · Building A · Floor 9 · 2-Bed', meta: 'Available', targetRoute: 'units' },
      { title: 'OFF-1204', subtitle: 'Skyline · Tower North · Floor 12 · Office', meta: 'Reserved', targetRoute: 'units' },
    ],
  },
  {
    group: 'Customers',
    items: [
      { title: 'Karim Abdelrahman', subtitle: 'CU-0001 · 2 units · EGP 11.2M', meta: 'Active', targetRoute: 'customer' },
      { title: 'Hala Mostafa', subtitle: 'CU-0002 · 1 unit · EGP 7.8M', meta: 'Active', targetRoute: 'customers' },
      { title: 'Omar Shaker', subtitle: 'CU-0004 · 3 offices · EGP 34.6M', meta: 'Active', targetRoute: 'customers' },
    ],
  },
  {
    group: 'Leads',
    items: [
      { title: 'Tarek ElGohary', subtitle: 'L-4814 · Negotiation · score 95', meta: 'Hot', targetRoute: 'pipeline' },
      { title: 'Hossam Adly', subtitle: 'L-4769 · Qualified · score 86', meta: 'Warm', targetRoute: 'leads' },
    ],
  },
  {
    group: 'Projects',
    items: [
      { title: 'North Hills', subtitle: 'New Cairo · 412 units · 74% sold', meta: 'Launched', targetRoute: 'project' },
      { title: 'Skyline Business Park', subtitle: 'New Capital · 184 units · 48% sold', meta: 'Construction', targetRoute: 'projects' },
    ],
  },
  {
    group: 'Contracts & Payments',
    items: [
      { title: 'C-0193', subtitle: 'Mona Fahmy · A-0712 · EGP 5.60M', meta: 'Signed', targetRoute: 'contracts' },
      { title: 'PM-88214', subtitle: 'Hala Mostafa · EGP 340,000', meta: 'Paid', targetRoute: 'payments' },
    ],
  },
  {
    group: 'Documents',
    items: [{ title: 'NH-B1204-Reservation.pdf', subtitle: 'Reservation form · 240 KB', meta: 'Verified', targetRoute: 'documents' }],
  },
];
