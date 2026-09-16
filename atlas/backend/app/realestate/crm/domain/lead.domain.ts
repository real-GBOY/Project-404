/**
 * Lead / Pipeline / Deals consolidation (see the plan's data-model section):
 * one `realestate_leads` row backs all three frontend screens. `stage` is the
 * 9-value funnel superset that drives the Pipeline kanban; `status` is the
 * narrower CRM status shown on the Leads table. `defaultStageFromStatus`
 * mirrors the frontend's `LEAD_STATUS_TO_STAGE` mapping used before any
 * manual drag-and-drop override is recorded.
 */
export type LeadStatus = "new" | "qualified" | "contacted" | "viewing" | "negotiation" | "lost";
export type LeadSource = "referral" | "website" | "facebook" | "broker" | "exhibition" | "instagram";
export type LeadStage =
  | "new"
  | "qualified"
  | "contacted"
  | "viewing"
  | "negotiation"
  | "reserved"
  | "contracted"
  | "sold"
  | "lost";

export function defaultStageFromStatus(status: LeadStatus): LeadStage {
  return status;
}

/** A lead is shown on the Sales > Deals screen once it carries deal-tracking fields. */
export function isDeal(lead: { probabilityPct: string | null; expectedCloseDate: string | null }): boolean {
  return lead.probabilityPct !== null || lead.expectedCloseDate !== null;
}
