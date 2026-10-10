/**
 * The fictional organizer of the demo deployment ("Nile Sessions Events", from the approved design) and everything it sells.
 * Pure data; `DemoSeeder` plays it through the real services so every invariant, audit entry and queued email is genuine.
 * Never enabled next to real data (see `demoSeedRefusal`).
 */

export const DEMO_PASSWORD = "demo-password-2026";

export const DEMO_ORG = {
  name: "Nile Sessions Events",
  slug: "nile-sessions",
  supportEmail: "hello@nilesessions.example",
};

export interface DemoPerson {
  key: string;
  name: string;
  email: string;
  /** Core RBAC role key (see shared/roles.ts). */
  roleKey: string;
  membershipRole: "owner" | "member";
  /** Events (by slug) this person works; owners and event managers see everything instead. */
  events?: string[];
  gate?: string;
}

export const DEMO_STAFF: DemoPerson[] = [
  { key: "owner", name: "Salma Adel", email: "salma@nilesessions.example", roleKey: "owner", membershipRole: "owner" },
  { key: "manager", name: "Dalia Samir", email: "dalia@nilesessions.example", roleKey: "event_manager", membershipRole: "member" },
  { key: "finance", name: "Karim Fathy", email: "karim@nilesessions.example", roleKey: "finance_reviewer", membershipRole: "member", events: ["*"] },
  {
    key: "door",
    name: "Ali Mansour",
    email: "ali@nilesessions.example",
    roleKey: "door_staff",
    membershipRole: "member",
    events: ["gallery-night-print-fair", "cairo-jazz-nights"],
    gate: "Gate A",
  },
  { key: "viewer", name: "Mona Hegazy", email: "mona@nilesessions.example", roleKey: "viewer", membershipRole: "member" },
];

export interface DemoVenue {
  key: string;
  name: string;
  area: string;
  address: string;
  capacity: number;
}

export const DEMO_VENUES: DemoVenue[] = [
  { key: "garden", name: "The Garden Stage", area: "Zamalek", address: "26th of July St., Zamalek, Cairo", capacity: 400 },
  { key: "falaki", name: "Falaki Hall", area: "Downtown", address: "Falaki Sq., Downtown, Cairo", capacity: 180 },
  { key: "rawabet", name: "Rawabet Stage", area: "Downtown", address: "Mahmoud Bassiouny St., Downtown, Cairo", capacity: 140 },
  { key: "campus", name: "Campus Hall", area: "Downtown", address: "Sheikh Rihan St., Downtown, Cairo", capacity: 300 },
  { key: "arena", name: "North Coast Arena", area: "Sahel", address: "km 128, Alexandria-Matrouh Rd, Sahel", capacity: 2500 },
  { key: "clay", name: "Clay House", area: "Maadi", address: "Road 9, Maadi, Cairo", capacity: 16 },
  { key: "corniche", name: "Maadi Corniche start line", area: "Maadi", address: "Corniche El Nil, Maadi, Cairo", capacity: 500 },
  { key: "annex", name: "Townhouse Annex", area: "Downtown", address: "Hussein Pasha St., Downtown, Cairo", capacity: 250 },
];

export interface DemoType {
  name: string;
  description: string;
  /** EGP, whole pounds. */
  price: number;
  quantity: number;
}

export interface DemoEvent {
  slug: string;
  title: string;
  category: string;
  description: string;
  venue: string;
  /** Days from now to the start; the end follows after `hours`. */
  startsInDays: number;
  startHour: number;
  hours: number;
  types: DemoType[];
  namedTickets: boolean;
  publish: boolean;
  program?: Array<{ time: string; title: string }>;
  policies?: { refund?: string; age?: string; entry?: string };
  /** The event that is "on tonight" for the scanner demo: it started an hour ago. */
  live?: boolean;
}

const POLICIES = {
  refund: "Refunds up to 72 hours before doors, minus transfer fees. Contact the organizer.",
  age: "Ages 16+. ID may be checked at the door.",
  entry: "Each QR code admits one person, once. Tickets are named; the organizer can change a holder once.",
};

export const DEMO_EVENTS: DemoEvent[] = [
  {
    slug: "cairo-jazz-nights",
    title: "Cairo Jazz Nights: The Nile Sessions",
    category: "Concert",
    description:
      "Three sets of modal jazz and Nubian-inflected improvisation in an open-air garden on the island.\n\nThe garden is outdoors with limited covered seating. Bring a layer; November evenings on the island are cool.",
    venue: "garden",
    startsInDays: 9,
    startHour: 20,
    hours: 4,
    namedTickets: true,
    publish: true,
    types: [
      { name: "General admission", description: "Standing on the garden lawn.", price: 450, quantity: 160 },
      { name: "Front standing", description: "Fenced area within 10 m of the stage. One drink included.", price: 750, quantity: 40 },
      { name: "Garden table for 4", description: "Reserved table, four seats, table service.", price: 2800, quantity: 2 },
    ],
    program: [
      { time: "19:00", title: "Doors open - food stalls on the lawn" },
      { time: "20:00", title: "Set one - The Nile Sessions Trio" },
      { time: "21:00", title: "Set two - with guests from Aswan" },
      { time: "22:00", title: "Set three - open session" },
      { time: "23:00", title: "Close" },
    ],
    policies: POLICIES,
  },
  {
    slug: "downtown-comedy-hour",
    title: "Downtown Comedy Hour",
    category: "Comedy",
    description: "A rotating line-up of Cairo's sharpest stand-ups, hosted by the house MC.",
    venue: "falaki",
    startsInDays: 15,
    startHour: 21,
    hours: 2,
    namedTickets: false,
    publish: true,
    types: [{ name: "General", description: "Unreserved seating.", price: 300, quantity: 150 }],
    policies: POLICIES,
  },
  {
    slug: "hamlet-reimagined",
    title: "Hamlet, Reimagined",
    category: "Theatre",
    description: "A stripped-back staging in Arabic and English, forty minutes shorter than you remember.",
    venue: "rawabet",
    startsInDays: 17,
    startHour: 19,
    hours: 3,
    namedTickets: true,
    publish: true,
    types: [
      { name: "Stalls", description: "Floor seating, rows A-H.", price: 350, quantity: 100 },
      { name: "Balcony", description: "Raised seating with a full view of the stage.", price: 250, quantity: 40 },
    ],
    policies: POLICIES,
  },
  {
    slug: "design-systems-cairo-2026",
    title: "Design Systems Cairo 2026",
    category: "Conference",
    description: "One day of talks and workshops for the people who build and maintain design systems.",
    venue: "campus",
    startsInDays: 20,
    startHour: 9,
    hours: 9,
    namedTickets: true,
    publish: true,
    types: [{ name: "Conference pass", description: "All talks, lunch and the closing session.", price: 1200, quantity: 300 }],
    policies: { refund: POLICIES.refund, entry: POLICIES.entry },
  },
  {
    slug: "sahel-sound-weekend",
    title: "Sahel Sound Weekend",
    category: "Festival",
    description: "Three days of live sets on the beach, from sunset to late. Camping and day passes available.",
    venue: "arena",
    startsInDays: 26,
    startHour: 15,
    hours: 40,
    namedTickets: false,
    publish: false,
    types: [
      { name: "Day pass", description: "One day.", price: 1800, quantity: 1200 },
      { name: "Weekend pass", description: "All three days.", price: 4200, quantity: 1000 },
      { name: "Weekend + camping", description: "All three days and a tent pitch.", price: 6500, quantity: 200 },
    ],
    policies: { refund: POLICIES.refund, age: "Ages 18+. Valid ID required.", entry: POLICIES.entry },
  },
  {
    slug: "wheel-ceramics-for-beginners",
    title: "Wheel Ceramics for Beginners",
    category: "Workshop",
    description: "Three hours at the wheel. You will leave with two pieces, fired and glazed by us.",
    venue: "clay",
    startsInDays: 28,
    startHour: 11,
    hours: 3,
    namedTickets: true,
    publish: true,
    types: [{ name: "Workshop seat", description: "All materials included.", price: 850, quantity: 16 }],
    policies: { refund: POLICIES.refund, entry: POLICIES.entry },
  },
  {
    slug: "corniche-10k-night-run",
    title: "Corniche 10K Night Run",
    category: "Sports",
    description: "A flat, fast 10K along the Nile after dark.",
    venue: "corniche",
    startsInDays: 33,
    startHour: 20,
    hours: 3,
    namedTickets: true,
    publish: false,
    types: [{ name: "Runner", description: "Bib and chip timing.", price: 400, quantity: 500 }],
    policies: POLICIES,
  },
  {
    slug: "gallery-night-print-fair",
    title: "Gallery Night: Cairo Print Fair",
    category: "Art",
    description: "An evening with Cairo's printmakers: prints, zines and a live press in the courtyard.",
    venue: "annex",
    startsInDays: 0,
    startHour: 0,
    hours: 5,
    namedTickets: true,
    publish: true,
    live: true,
    types: [
      { name: "Entry", description: "Entry to the fair.", price: 150, quantity: 200 },
      { name: "Entry + catalogue", description: "Entry and the printed catalogue.", price: 300, quantity: 50 },
    ],
    policies: POLICIES,
  },
];

export const DEMO_METHODS = [
  {
    type: "instapay" as const,
    label: "InstaPay",
    recipientName: "Nile Sessions Events",
    identifier: "nilesessions@instapay",
    instructions: [
      "Open your bank app or the InstaPay app and choose Send money, then IPA.",
      "Paste the address above and check the recipient name matches.",
      "Enter exactly the total shown. A different amount delays verification.",
      "Add your booking reference in the note, send, and screenshot the confirmation.",
    ],
  },
  {
    type: "wallet" as const,
    label: "Vodafone Cash",
    recipientName: "Nile Sessions Events",
    identifier: "010 0000 0000",
    instructions: [
      "Open the Vodafone Cash app or menu and choose Transfer money.",
      "Enter the wallet number above and confirm the registered name.",
      "Enter exactly the total shown and confirm with your PIN.",
      "Screenshot the app receipt or confirmation SMS, including the transaction ID.",
    ],
  },
  {
    type: "bank" as const,
    label: "Bank transfer",
    recipientName: "Nile Sessions Events LLC",
    identifier: "EG00 0000 0000 0000 0000 0000 0000 0",
    instructions: [
      "Create a transfer to the account above from your bank.",
      "Use your booking reference as the transfer reference.",
      "Bank transfers can take one working day to arrive.",
      "Download or screenshot the transfer receipt.",
    ],
  },
];

export interface DemoCustomer {
  name: string;
  email: string;
  phone: string;
}

export const DEMO_CUSTOMERS: DemoCustomer[] = [
  { name: "Nour Hassan", email: "nour.hassan@example.com", phone: "010 1234 5678" },
  { name: "Omar Said", email: "omar.said@example.com", phone: "010 5550 2290" },
  { name: "Hana Mostafa", email: "hana.m@example.com", phone: "012 7781 4402" },
  { name: "Yasmin Ali", email: "yasmin.ali@example.com", phone: "012 2211 0934" },
  { name: "Mariam Khaled", email: "mariam.k@example.com", phone: "011 5550 7781" },
  { name: "Karim Fathy", email: "karim.fathy@example.com", phone: "010 8812 3345" },
  { name: "Ahmed Samir", email: "a.samir@example.com", phone: "015 4420 1188" },
  { name: "Dina Farouk", email: "dina.f@example.com", phone: "011 5550 8811" },
  { name: "Youssef Gamal", email: "y.gamal@example.com", phone: "012 5550 4410" },
  { name: "Laila Mostafa", email: "laila.m@example.com", phone: "015 5550 3307" },
  { name: "Sara Nabil", email: "sara.nabil@example.com", phone: "010 5550 1212" },
  { name: "Tarek Said", email: "tarek.said@example.com", phone: "011 5550 9090" },
];

export type DemoOutcome = "confirmed" | "in_review" | "awaiting" | "rejected_resubmitted" | "rejected_open" | "expired" | "cancelled" | "email_failed";

export interface DemoBooking {
  event: string;
  customer: number;
  /** Ticket type index within the event -> quantity. */
  qty: Array<[number, number]>;
  outcome: DemoOutcome;
  /** Days ago the booking was made (cosmetic: spreads the sales chart). */
  daysAgo: number;
  /** Fewer than quantity holder names are fine; the rest fall back to the owner. */
  holders?: string[];
  /** Check these tickets in (live event only). */
  checkedIn?: number;
}

export const DEMO_BOOKINGS: DemoBooking[] = [
  // Cairo Jazz Nights
  {
    event: "cairo-jazz-nights",
    customer: 1,
    qty: [[0, 4]],
    outcome: "confirmed",
    daysAgo: 8,
    holders: ["Omar Said", "Salma Said", "Hassan Said", "Reem Said"],
  },
  { event: "cairo-jazz-nights", customer: 10, qty: [[1, 1]], outcome: "confirmed", daysAgo: 7, holders: ["Sara Nabil"] },
  { event: "cairo-jazz-nights", customer: 9, qty: [[0, 2]], outcome: "confirmed", daysAgo: 6, holders: ["Laila Mostafa", "Nada Mostafa"] },
  { event: "cairo-jazz-nights", customer: 7, qty: [[0, 2]], outcome: "email_failed", daysAgo: 5, holders: ["Dina Farouk", "Rami Farouk"] },
  {
    event: "cairo-jazz-nights",
    customer: 0,
    qty: [
      [0, 2],
      [1, 1],
    ],
    outcome: "in_review",
    daysAgo: 0,
    holders: ["Nour Hassan", "Omar Hassan", "Laila Mostafa"],
  },
  { event: "cairo-jazz-nights", customer: 5, qty: [[0, 2]], outcome: "in_review", daysAgo: 0, holders: ["Karim Fathy", "Mona Fathy"] },
  { event: "cairo-jazz-nights", customer: 8, qty: [[0, 2]], outcome: "rejected_open", daysAgo: 1, holders: ["Youssef Gamal", "Adam Gamal"] },
  { event: "cairo-jazz-nights", customer: 6, qty: [[1, 2]], outcome: "awaiting", daysAgo: 0, holders: ["Ahmed Samir", "Yara Samir"] },
  { event: "cairo-jazz-nights", customer: 11, qty: [[0, 1]], outcome: "cancelled", daysAgo: 4, holders: ["Tarek Said"] },
  // Downtown Comedy Hour
  { event: "downtown-comedy-hour", customer: 2, qty: [[0, 2]], outcome: "in_review", daysAgo: 0 },
  { event: "downtown-comedy-hour", customer: 9, qty: [[0, 3]], outcome: "confirmed", daysAgo: 6 },
  { event: "downtown-comedy-hour", customer: 0, qty: [[0, 2]], outcome: "confirmed", daysAgo: 3 },
  // Hamlet
  { event: "hamlet-reimagined", customer: 3, qty: [[0, 2]], outcome: "rejected_resubmitted", daysAgo: 2, holders: ["Yasmin Ali", "Ziad Ali"] },
  { event: "hamlet-reimagined", customer: 0, qty: [[0, 1]], outcome: "awaiting", daysAgo: 1, holders: ["Nour Hassan"] },
  { event: "hamlet-reimagined", customer: 1, qty: [[1, 2]], outcome: "confirmed", daysAgo: 5, holders: ["Omar Said", "Mostafa Adel"] },
  // Design Systems Cairo
  { event: "design-systems-cairo-2026", customer: 6, qty: [[0, 1]], outcome: "in_review", daysAgo: 0, holders: ["Ahmed Samir"] },
  { event: "design-systems-cairo-2026", customer: 7, qty: [[0, 2]], outcome: "confirmed", daysAgo: 7, holders: ["Dina Farouk", "Hazem Farouk"] },
  // Wheel Ceramics
  { event: "wheel-ceramics-for-beginners", customer: 4, qty: [[0, 1]], outcome: "in_review", daysAgo: 0, holders: ["Mariam Khaled"] },
  { event: "wheel-ceramics-for-beginners", customer: 0, qty: [[0, 1]], outcome: "expired", daysAgo: 3, holders: ["Nour Hassan"] },
  // Print Fair (live tonight)
  { event: "gallery-night-print-fair", customer: 11, qty: [[0, 2]], outcome: "confirmed", daysAgo: 9, holders: ["Tarek Said", "Mona Taha"], checkedIn: 2 },
  { event: "gallery-night-print-fair", customer: 2, qty: [[1, 2]], outcome: "confirmed", daysAgo: 8, holders: ["Hana Mostafa", "Ramy Fouad"], checkedIn: 1 },
  { event: "gallery-night-print-fair", customer: 9, qty: [[0, 3]], outcome: "confirmed", daysAgo: 6, holders: ["Laila Mostafa", "Hossam Ezz", "Nadia Kamal"] },
];
