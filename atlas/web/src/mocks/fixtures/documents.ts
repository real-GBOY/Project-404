// Extracted verbatim from the design prototype's document register (`docs`, inside `moreVals()`) used
// by the /documents route, plus the unit-detail document list authored inside `screenVals()` for a
// "Sold"-status unit.

export interface DocumentFixture {
  name: string;
  type: string;
  /** The related entity this document belongs to (unit, contract, customer, project, etc.) */
  owner: string;
  size: string;
  uploadedBy: string;
  date: string;
  status: 'Verified' | 'Pending' | 'Draft';
}

export const DOCUMENTS: DocumentFixture[] = [
  { name: 'NH-B1204-Reservation.pdf', type: 'Reservation form', owner: 'Unit B-1204', size: '240 KB', uploadedBy: 'Ahmed Mohamed', date: '11 Mar 2026', status: 'Verified' },
  { name: 'C-0193-Signed.pdf', type: 'Contract', owner: 'Contract C-0193', size: '2.4 MB', uploadedBy: 'Mohamed Adel', date: '02 Mar 2026', status: 'Verified' },
  { name: 'CU-0002-NationalID.jpg', type: 'KYC · National ID', owner: 'Hala Mostafa', size: '1.2 MB', uploadedBy: 'Sara Fathy', date: '28 Feb 2026', status: 'Verified' },
  { name: 'PlanA-0508.pdf', type: 'Payment plan', owner: 'Unit A-0508', size: '186 KB', uploadedBy: 'Finance', date: '21 Feb 2026', status: 'Verified' },
  { name: 'Skyline-Floorplates.dwg', type: 'Drawing', owner: 'Skyline · Tower North', size: '8.1 MB', uploadedBy: 'Operations', date: '18 Feb 2026', status: 'Pending' },
  { name: 'PM-88198-Transfer.png', type: 'Payment proof', owner: 'Payment PM-88198', size: '540 KB', uploadedBy: 'Sherif Zaki', date: '09 Mar 2026', status: 'Pending' },
  { name: 'Cedar-Handover-Checklist.xlsx', type: 'Handover', owner: 'Cedar Residences', size: '92 KB', uploadedBy: 'Operations', date: '06 Mar 2026', status: 'Draft' },
  { name: 'NH-PriceList-v4.2.pdf', type: 'Price list', owner: 'North Hills', size: '310 KB', uploadedBy: 'Nadine Farid', date: '01 Mar 2026', status: 'Verified' },
];

// File extension badge shown in the UI is derived, not authored: ext = name.split('.').pop().toUpperCase()

// Unit-detail documents (authored for a generic "Sold" status unit in the unit drawer):
export interface UnitDocumentFixture {
  name: string;
  size: string;
  status: 'Verified' | 'Pending';
}

export const UNIT_DETAIL_DOCUMENTS: UnitDocumentFixture[] = [
  { name: 'Reservation form.pdf', size: '240 KB', status: 'Verified' },
  { name: 'National ID.jpg', size: '1.2 MB', status: 'Verified' },
  { name: 'Payment plan.pdf', size: '186 KB', status: 'Pending' },
  { name: 'Unit layout.dwg', size: '3.4 MB', status: 'Verified' },
];

// See customers.ts CUSTOMER_DETAIL_C1.documents for the per-customer document list variant.
