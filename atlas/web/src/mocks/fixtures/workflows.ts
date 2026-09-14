// Extracted verbatim from the design prototype's workflow-step template (`wfSteps`, inside `moreVals()`)
// used to illustrate the Workflows screen's example approval chain (a reservation -> signed contract
// flow for unit B-1204 / Contract C-0193-ish path).

export interface WorkflowStepFixture {
  label: string;
  who: string;
  when: string;
  state: 'done' | 'current' | 'todo';
}

export const WORKFLOW_EXAMPLE_STEPS: WorkflowStepFixture[] = [
  { label: 'Reservation', who: 'Sales agent', when: '11 Mar · 14:42', state: 'done' },
  { label: 'Manager Approval', who: 'Mohamed Adel', when: '11 Mar · 15:10', state: 'done' },
  { label: 'Contract Preparation', who: 'Sales admin', when: '11 Mar · 16:02', state: 'done' },
  { label: 'Contract Approval', who: 'Commercial Director', when: 'pending · 40 min', state: 'current' },
  { label: 'Signed', who: 'Customer', when: '—', state: 'todo' },
];

// Screen subtitle (authored, route 'workflows'): "4 active workflow definitions · 7 items pending
// approval". The same screen component also serves the /approvals route with a different title/subtitle
// ("Approvals" · "7 approvals pending · 2 escalated past SLA") — see approvals.ts for the approval queue
// rows themselves.

// GAP: only 4 workflow *definitions* are implied by the subtitle copy ("4 active workflow definitions")
// but no list of the other 3 definitions (beyond the reservation-to-contract example above) was authored
// in the source — only this one example step chain exists.
