/**
 * Turns an audit action key into the design's activity line: "<who> <verb> <subject>". The
 * audit trail itself (Core) stays machine-shaped; this is presentation only. Unknown actions
 * fall back to a readable form of the key, so a new action never shows up blank.
 */
export type Severity = "info" | "warning";

const VERBS: Record<string, string> = {
  "hotel.reservation.created": "created reservation",
  "hotel.reservation.confirmed": "confirmed reservation",
  "hotel.reservation.cancelled": "cancelled reservation",
  "hotel.reservation.no_show": "marked as no-show",
  "hotel.reservation.checked_in": "checked in",
  "hotel.reservation.checked_out": "checked out",
  "hotel.reservation.room_changed": "moved the room for",
  "hotel.reservation.dates_changed": "changed the dates of",
  "hotel.reservation.extended": "extended the stay of",
  "hotel.folio.charge_posted": "posted a charge to",
  "hotel.folio.charge_voided": "voided a charge on",
  "hotel.payment.completed": "took a payment for",
  "hotel.payment.failed": "had a payment declined for",
  "hotel.refund.completed": "refunded",
  "hotel.refund.failed": "had a refund declined for",
  "hotel.invoice.issued": "issued invoice",
  "hotel.invoice.voided": "voided invoice",
  "hotel.guest.created": "registered guest",
  "hotel.guest.updated": "updated guest",
  "hotel.guest.note_added": "added a note to",
  "hotel.room.created": "added",
  "hotel.room.updated": "updated",
  "hotel.room.archived": "archived",
  "hotel.room_type.created": "added room type",
  "hotel.room_type.updated": "updated room type",
  "hotel.room_type.archived": "archived room type",
  "hotel.rate_rule.created": "added rate rule",
  "hotel.rate_rule.archived": "archived rate rule",
  "hotel.discount.created": "added discount",
  "hotel.discount.archived": "archived discount",
  "hotel.settings.updated": "updated the hotel settings",
  "hotel.staff.added": "added staff member",
  "hotel.staff.removed": "removed staff member",
  "hotel.staff.role_changed": "changed the role of",
  "hotel.housekeeping.task_created": "opened a cleaning task for",
  "hotel.housekeeping.task_assigned": "assigned cleaning of",
  "hotel.housekeeping.task_started": "started cleaning",
  "hotel.housekeeping.task_completed": "finished cleaning",
  "hotel.housekeeping.task_inspected": "inspected",
  "hotel.maintenance.reported": "reported",
  "hotel.maintenance.assigned": "assigned",
  "hotel.maintenance.started": "started work on",
  "hotel.maintenance.resolved": "resolved",
  "hotel.maintenance.reopened": "reopened",
  "hotel.maintenance.verified": "verified the repair of",
  "hotel.maintenance.note": "added a note to",
  "hotel.maintenance.cost_updated": "updated the cost of",
  "hotel.maintenance.block_extended": "extended the room block for",
  "hotel.guest.document_added": "attached a document to",
  "hotel.guest.document_removed": "removed a document from",
  // Core's own actions, as they appear in this hotel's trail.
  "user.logged_in": "signed in",
  "user.registered": "created an account for",
  "user.password_reset": "reset the password of",
  "user.email_verified": "verified the email of",
  "organization.member_added": "added staff member",
  "organization.member_removed": "removed staff member",
  "organization.settings_updated": "updated the organization settings",
  "rbac.role_assigned": "set the role of",
  "rbac.role_removed": "removed the role of",
};

const WARNINGS = new Set([
  "hotel.reservation.cancelled",
  "hotel.reservation.no_show",
  "hotel.folio.charge_voided",
  "hotel.payment.failed",
  "hotel.refund.completed",
  "hotel.refund.failed",
  "hotel.invoice.voided",
  "hotel.staff.removed",
  "hotel.staff.role_changed",
  "hotel.maintenance.reported",
  "hotel.maintenance.reopened",
  "hotel.settings.updated",
]);

export function describeAction(action: string): { verb: string; severity: Severity } {
  const verb =
    VERBS[action] ??
    action
      .replace(/^hotel\./, "")
      .split(/[._]/)
      .join(" ");
  return { verb, severity: WARNINGS.has(action) ? "warning" : "info" };
}
