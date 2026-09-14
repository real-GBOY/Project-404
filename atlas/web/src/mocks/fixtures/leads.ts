// Extracted verbatim from the design prototype's `LEADS` class field.

export interface LeadFixture {
  id: string;
  name: string;
  phone: string;
  source: 'Referral' | 'Website' | 'Facebook' | 'Broker' | 'Exhibition' | 'Instagram';
  status: 'New' | 'Qualified' | 'Contacted' | 'Viewing' | 'Negotiation' | 'Lost';
  /** Lead score, 0-100 */
  score: number;
  interest: string;
  /** Formatted deal value, e.g. "EGP 5.4M" */
  value: string;
  agent: string;
  lastActivity: string;
}

export const LEADS: LeadFixture[] = [
  { id: 'L-4821', name: 'Karim Abdelrahman', phone: '+20 100 244 8713', source: 'Referral', status: 'Qualified', score: 92, interest: 'North Hills · A-0904', value: 'EGP 5.4M', agent: 'Ahmed Mohamed', lastActivity: '2h ago' },
  { id: 'L-4818', name: 'Hala Mostafa', phone: '+20 122 887 4410', source: 'Website', status: 'Viewing', score: 88, interest: 'Cedar Residences · C-0311', value: 'EGP 7.8M', agent: 'Sara Fathy', lastActivity: '5h ago' },
  { id: 'L-4814', name: 'Tarek ElGohary', phone: '+20 111 903 2287', source: 'Facebook', status: 'Negotiation', score: 95, interest: 'North Hills · B-1204', value: 'EGP 4.85M', agent: 'Ahmed Mohamed', lastActivity: '1d ago' },
  { id: 'L-4809', name: 'Yasmine Saad', phone: '+20 128 445 9021', source: 'Broker', status: 'New', score: 61, interest: 'Palm District · D-0705', value: 'EGP 3.2M', agent: 'Nour ElSayed', lastActivity: '6d ago' },
  { id: 'L-4802', name: 'Omar Shaker', phone: '+20 106 772 1145', source: 'Exhibition', status: 'Contacted', score: 74, interest: 'Skyline · Office 12-04', value: 'EGP 12.4M', agent: 'Youssef Hegazy', lastActivity: '3d ago' },
  { id: 'L-4797', name: 'Dina Nabil', phone: '+20 109 331 5580', source: 'Website', status: 'Qualified', score: 83, interest: 'Cedar Residences · C-0208', value: 'EGP 6.9M', agent: 'Menna Kamal', lastActivity: '9h ago' },
  { id: 'L-4791', name: 'Mahmoud Fawzy', phone: '+20 127 660 3392', source: 'Referral', status: 'Viewing', score: 79, interest: 'North Hills · A-1102', value: 'EGP 5.1M', agent: 'Mohamed Adel', lastActivity: '2d ago' },
  { id: 'L-4786', name: 'Nadia Rashad', phone: '+20 101 552 7734', source: 'Instagram', status: 'New', score: 48, interest: 'West Avenue · WA-204', value: 'EGP 2.8M', agent: 'Kariman Osman', lastActivity: '7d ago' },
  { id: 'L-4780', name: 'Sherif Zaki', phone: '+20 112 448 9917', source: 'Broker', status: 'Negotiation', score: 90, interest: 'Palm District · D-1401', value: 'EGP 8.6M', agent: 'Sara Fathy', lastActivity: '4h ago' },
  { id: 'L-4775', name: 'Aya Khalil', phone: '+20 100 887 2201', source: 'Website', status: 'Lost', score: 32, interest: 'North Hills · B-0408', value: 'EGP 4.2M', agent: 'Nour ElSayed', lastActivity: '12d ago' },
  { id: 'L-4769', name: 'Hossam Adly', phone: '+20 128 119 4463', source: 'Referral', status: 'Qualified', score: 86, interest: 'Skyline · Office 08-02', value: 'EGP 15.2M', agent: 'Youssef Hegazy', lastActivity: '1d ago' },
  { id: 'L-4761', name: 'Mariam Selim', phone: '+20 106 220 8814', source: 'Facebook', status: 'Contacted', score: 67, interest: 'Cedar Residences · C-0104', value: 'EGP 6.1M', agent: 'Menna Kamal', lastActivity: '8d ago' },
];

// Screen KPIs (authored, not recomputed from LEADS above — the table shows only a 12-row sample of a
// notionally much larger 1,842-lead dataset): Active leads 312 (+8.2%), Qualified 148 (+11.4%), Avg. lead
// score 74 (+3), Untouched 5d+ 23 (+6), Conversion rate 11.8% (+1.4pp). Subtitle: "1,842 leads · 312
// active this month · 23 with no activity for 5+ days".
