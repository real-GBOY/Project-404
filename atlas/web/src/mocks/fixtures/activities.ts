// Extracted verbatim from the design prototype's "Activities" table screen (TABLES().activities).

export interface ActivityFixture {
  type: 'Contacted' | 'Viewing' | 'Negotiation' | 'Paid' | 'New';
  subject: string;
  relatedTo: string;
  agent: string;
  outcome: string;
  when: string;
}

export const ACTIVITIES: ActivityFixture[] = [
  { type: 'Contacted', subject: 'Discovery call — budget confirmed', relatedTo: 'Lead L-4821 · Karim Abdelrahman', agent: 'Ahmed Mohamed', outcome: 'Qualified', when: '2h ago' },
  { type: 'Viewing', subject: 'Site visit — Cedar C-0311', relatedTo: 'Lead L-4818 · Hala Mostafa', agent: 'Sara Fathy', outcome: 'Second visit booked', when: '5h ago' },
  { type: 'Negotiation', subject: 'Discount request 4% on B-1204', relatedTo: 'Lead L-4814 · Tarek ElGohary', agent: 'Ahmed Mohamed', outcome: 'Escalated to manager', when: '1d ago' },
  { type: 'Contacted', subject: 'Follow-up call — no answer', relatedTo: 'Lead L-4809 · Yasmine Saad', agent: 'Nour ElSayed', outcome: 'Retry scheduled', when: '1d ago' },
  { type: 'Paid', subject: 'Installment #4 confirmed', relatedTo: 'Customer CU-0002 · Hala Mostafa', agent: 'Finance Bot', outcome: 'EGP 340,000 received', when: '2d ago' },
  { type: 'Viewing', subject: 'Office tour — Skyline 12-04', relatedTo: 'Lead L-4802 · Omar Shaker', agent: 'Youssef Hegazy', outcome: 'Proposal requested', when: '3d ago' },
  { type: 'New', subject: 'Inbound WhatsApp enquiry', relatedTo: 'Lead L-4786 · Nadia Rashad', agent: 'Kariman Osman', outcome: 'Assigned', when: '7d ago' },
];

// Screen KPIs (authored): Activities today 148 (+22), Calls 64, Viewings 19 (+4), Avg. response time
// 2h 14m (-18m). Subtitle: "All logged calls, meetings, viewings and notes across the organisation".
