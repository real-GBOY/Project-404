// Extracted verbatim from the design prototype's "Deals" table screen (TABLES().deals).

export interface DealFixture {
  id: string;
  customer: string;
  unit: string;
  value: string;
  stage: 'Negotiation' | 'Reserved' | 'Viewing' | 'Qualified' | 'Lost';
  /** Close probability, 0-100 */
  probabilityPct: number;
  expectedClose: string;
  agent: string;
}

export const DEALS: DealFixture[] = [
  { id: 'D-2291', customer: 'Tarek ElGohary', unit: 'B-1204 · North Hills', value: 'EGP 4.85M', stage: 'Negotiation', probabilityPct: 85, expectedClose: '18 Mar 2026', agent: 'Ahmed Mohamed' },
  { id: 'D-2288', customer: 'Sherif Zaki', unit: 'D-1401 · Palm District', value: 'EGP 8.60M', stage: 'Negotiation', probabilityPct: 80, expectedClose: '22 Mar 2026', agent: 'Sara Fathy' },
  { id: 'D-2284', customer: 'Hala Mostafa', unit: 'C-0311 · Cedar Residences', value: 'EGP 7.80M', stage: 'Reserved', probabilityPct: 92, expectedClose: '16 Mar 2026', agent: 'Sara Fathy' },
  { id: 'D-2279', customer: 'Hossam Adly', unit: 'OFF-0802 · Skyline', value: 'EGP 15.20M', stage: 'Viewing', probabilityPct: 55, expectedClose: '04 Apr 2026', agent: 'Youssef Hegazy' },
  { id: 'D-2274', customer: 'Karim Abdelrahman', unit: 'A-0904 · North Hills', value: 'EGP 5.40M', stage: 'Reserved', probabilityPct: 90, expectedClose: '19 Mar 2026', agent: 'Ahmed Mohamed' },
  { id: 'D-2268', customer: 'Dina Nabil', unit: 'C-0208 · Cedar Residences', value: 'EGP 6.90M', stage: 'Qualified', probabilityPct: 45, expectedClose: '28 Mar 2026', agent: 'Menna Kamal' },
  { id: 'D-2261', customer: 'Omar Shaker', unit: 'OFF-1204 · Skyline', value: 'EGP 12.40M', stage: 'Negotiation', probabilityPct: 72, expectedClose: '25 Mar 2026', agent: 'Youssef Hegazy' },
  { id: 'D-2255', customer: 'Aya Khalil', unit: 'B-0408 · North Hills', value: 'EGP 4.20M', stage: 'Lost', probabilityPct: 0, expectedClose: '—', agent: 'Nour ElSayed' },
];

// Screen KPIs (authored): Open deals 84 (+7), Pipeline value EGP 1.86B (+12.1%), Weighted EGP 1.12B
// (+9.6%), Avg. deal value EGP 6.2M (+4.0%), Win rate 64.8% (+1.9pp). Subtitle: "84 open deals · EGP
// 1.12B weighted pipeline · close probability from stage and activity" — note "weighted" pipeline value
// implies weighted = sum(value * probabilityPct/100) per the subtitle's own description, though DEALS
// above is only an 8-row sample so it won't reproduce the EGP 1.12B total exactly.
