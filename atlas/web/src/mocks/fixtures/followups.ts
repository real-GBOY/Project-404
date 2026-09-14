// Extracted verbatim from the design prototype's "Follow-ups" table screen (TABLES().followups).

export interface FollowupFixture {
  priority: 'High' | 'Medium' | 'Low';
  leadOrCustomer: string;
  reason: string;
  agent: string;
  due: string;
  status: 'Overdue' | 'Open' | 'In Progress';
}

export const FOLLOWUPS: FollowupFixture[] = [
  { priority: 'High', leadOrCustomer: 'Tarek ElGohary', reason: 'Discount decision pending — deal EGP 4.85M', agent: 'Ahmed Mohamed', due: '2d overdue', status: 'Overdue' },
  { priority: 'High', leadOrCustomer: 'Hossam Adly', reason: 'Proposal for Skyline Office 08-02', agent: 'Youssef Hegazy', due: '1d overdue', status: 'Overdue' },
  { priority: 'High', leadOrCustomer: 'Sherif Zaki', reason: 'Reservation expires in 2 days', agent: 'Sara Fathy', due: 'Today 16:00', status: 'Open' },
  { priority: 'Medium', leadOrCustomer: 'Dina Nabil', reason: 'Down payment confirmation', agent: 'Menna Kamal', due: 'Today 18:30', status: 'Open' },
  { priority: 'Medium', leadOrCustomer: 'Yasmine Saad', reason: 'No contact for 6 days', agent: 'Nour ElSayed', due: 'Tomorrow', status: 'Open' },
  { priority: 'Low', leadOrCustomer: 'Nadia Rashad', reason: 'Re-qualify after campaign', agent: 'Kariman Osman', due: 'Thu 12 Mar', status: 'Open' },
  { priority: 'Medium', leadOrCustomer: 'Mariam Selim', reason: 'Second viewing scheduling', agent: 'Menna Kamal', due: 'Fri 13 Mar', status: 'In Progress' },
];

// Screen KPIs (authored): Overdue 23 (+6), Due today 41, Completed 7d 186 (+12%), On-time rate 82.4%
// (-3.1pp). Subtitle: "23 follow-ups overdue · 41 due today · SLA target 24h after last contact".
