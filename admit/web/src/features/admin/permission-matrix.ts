/** The permissions shown as rows of the role matrix, in the words an organizer uses. */
export const MATRIX: [string, string][] = [
  ["Review & approve payments", "approve:payment"],
  ["Reject payments", "reject:payment"],
  ["View payment proofs", "read:payment"],
  ["Create & edit events", "create:event"],
  ["Publish & cancel events", "publish:event"],
  ["Manage ticket types & inventory", "manage:ticket_type"],
  ["Edit payment recipient details", "manage:payment_method"],
  ["See every event (not just assigned)", "read_all:event"],
  ["View bookings & customers", "read:booking"],
  ["Cancel bookings", "cancel:booking"],
  ["Revoke tickets", "revoke:ticket"],
  ["Retry failed emails", "retry:email"],
  ["Scan tickets at the door", "scan:checkin"],
  ["Reports & analytics", "read:report"],
  ["Manage event staff", "manage:event_staff"],
];
