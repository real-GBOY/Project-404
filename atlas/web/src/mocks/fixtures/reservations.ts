// Extracted verbatim from the design prototype's "Reservations" table screen (TABLES().reservations).

export interface ReservationFixture {
  unitId: string;
  unitLocation: string;
  customer: string;
  agent: string;
  reservedDate: string;
  /** e.g. "in 1 day · 14 Mar" or "expired 09 Mar" */
  expires: string;
  deposit: string;
  status: 'Expiring' | 'Active' | 'Expired';
}

export const RESERVATIONS: ReservationFixture[] = [
  { unitId: 'B-1204', unitLocation: 'North Hills · Bldg B', customer: 'Tarek ElGohary', agent: 'Ahmed Mohamed', reservedDate: '28 Feb', expires: 'in 1 day · 14 Mar', deposit: 'EGP 145,500', status: 'Expiring' },
  { unitId: 'D-1401', unitLocation: 'Palm District · Bldg D', customer: 'Sherif Zaki', agent: 'Sara Fathy', reservedDate: '01 Mar', expires: 'in 2 days · 15 Mar', deposit: 'EGP 258,000', status: 'Expiring' },
  { unitId: 'C-0311', unitLocation: 'Cedar Residences · Cedar 2', customer: 'Hala Mostafa', agent: 'Sara Fathy', reservedDate: '03 Mar', expires: 'in 4 days · 17 Mar', deposit: 'EGP 234,000', status: 'Active' },
  { unitId: 'A-0904', unitLocation: 'North Hills · Bldg A', customer: 'Karim Abdelrahman', agent: 'Ahmed Mohamed', reservedDate: '05 Mar', expires: 'in 6 days · 19 Mar', deposit: 'EGP 162,000', status: 'Active' },
  { unitId: 'OFF-1204', unitLocation: 'Skyline · Tower North', customer: 'Omar Shaker', agent: 'Youssef Hegazy', reservedDate: '06 Mar', expires: 'in 7 days · 20 Mar', deposit: 'EGP 372,000', status: 'Active' },
  { unitId: 'C-0208', unitLocation: 'Cedar Residences · Cedar 1', customer: 'Dina Nabil', agent: 'Menna Kamal', reservedDate: '07 Mar', expires: 'in 8 days · 21 Mar', deposit: 'EGP 207,000', status: 'Active' },
  { unitId: 'WA-204', unitLocation: 'West Avenue · Block 1', customer: 'Ziad Hafez', agent: 'Kariman Osman', reservedDate: '08 Mar', expires: 'in 9 days · 22 Mar', deposit: 'EGP 93,000', status: 'Active' },
  { unitId: 'A-1102', unitLocation: 'North Hills · Bldg A', customer: 'Mahmoud Fawzy', agent: 'Mohamed Adel', reservedDate: '24 Feb', expires: 'expired 09 Mar', deposit: 'EGP 153,000', status: 'Expired' },
];

// Screen KPIs (authored): Active 110 (+12), Expiring ≤48h 4, Reserved value EGP 682M (+8.4%), Conversion
// to contract 78.2% (+2.6pp). Subtitle: "110 active reservations · 4 expiring within 48 hours · EGP 682M
// reserved value" — RESERVATIONS above is an 8-row sample of that larger dataset.
