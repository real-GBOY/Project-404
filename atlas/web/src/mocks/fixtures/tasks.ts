// Extracted verbatim from the design prototype's "Tasks" table screen (TABLES().tasks).

export interface TaskFixture {
  priority: 'High' | 'Medium' | 'Low';
  task: string;
  relatedTo: string;
  assignee: string;
  due: string;
  status: 'In Progress' | 'Open' | 'Done';
}

export const TASKS: TaskFixture[] = [
  { priority: 'High', task: 'Collect signed contract C-0191', relatedTo: 'Contract C-0191 · Hala Mostafa', assignee: 'Sara Fathy', due: 'Today', status: 'In Progress' },
  { priority: 'High', task: 'Reservation B-1204 expires in 24h', relatedTo: 'Unit B-1204 · North Hills', assignee: 'Ahmed Mohamed', due: 'Today', status: 'Open' },
  { priority: 'High', task: 'Escalate 90+ arrears — Amr Selim', relatedTo: 'Customer CU-0114', assignee: 'Collections', due: 'Today', status: 'Open' },
  { priority: 'Medium', task: 'Prepare Skyline Q2 price list', relatedTo: 'Pricing · Skyline', assignee: 'Nadine Farid', due: 'Tomorrow', status: 'In Progress' },
  { priority: 'Medium', task: 'Verify 4 uploaded ID documents', relatedTo: 'Documents · KYC queue', assignee: 'Operations', due: '13 Mar', status: 'Open' },
  { priority: 'Low', task: 'Re-qualify 18 dormant leads', relatedTo: 'Leads · dormant segment', assignee: 'Kariman Osman', due: '16 Mar', status: 'Open' },
  { priority: 'Medium', task: 'Schedule Cedar 2 handover inspections', relatedTo: 'Cedar Residences', assignee: 'Operations', due: '18 Mar', status: 'Done' },
];

// Screen KPIs (authored): Open 186 (+14), Due today 42, Overdue 19 (+3), Completed 7d 241 (+9%).
// Subtitle: "186 open tasks · 42 due today · assigned across sales, finance and operations" — TASKS
// above is a 7-row sample of that larger dataset.
