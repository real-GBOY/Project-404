import type { Json } from "../../../../../core/kernel/db/json.js";
import type { ColumnType } from "kysely";
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type realestate_activities = {
  id: string;
  organization_id: string;
  /**
   * @kyselyType('call' | 'meeting' | 'viewing' | 'email' | 'note' | 'whatsapp')
   */
  type: "call" | "meeting" | "viewing" | "email" | "note" | "whatsapp";
  subject: string;
  /**
   * polymorphic label, e.g. "lead" | "customer" — no cross-table FK (matches
   * every source screen's free-text relatedTo)
   */
  related_type: string | null;
  related_id: string | null;
  agent_id: string;
  outcome: string | null;
  occurred_at: Generated<Timestamp>;
  created_at: Generated<Timestamp>;
};
export type realestate_ai_insights = {
  id: string;
  organization_id: string;
  /**
   * @kyselyType('dashboard' | 'feed')
   */
  kind: "dashboard" | "feed";
  tag: string;
  confidence: string;
  text: string;
  detail: string;
  cta: string;
  target_route: string | null;
  dismissed_by: string | null;
  dismissed_at: Timestamp | null;
  created_at: Generated<Timestamp>;
};
export type realestate_approvals = {
  id: string;
  organization_id: string;
  /**
   * @kyselyType('discount' | 'refund' | 'contract' | 'commission' | 'other')
   */
  kind: "discount" | "refund" | "contract" | "commission" | "other";
  subject: string;
  related_type: string | null;
  related_id: string | null;
  /**
   * @kyselyType(number)
   */
  amount_egp: number | null;
  requested_by: string;
  step_no: Generated<number>;
  step_total: Generated<number>;
  /**
   * @kyselyType('awaiting-approval' | 'escalated' | 'approved' | 'rejected')
   */
  status: Generated<"awaiting-approval" | "escalated" | "approved" | "rejected">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_buildings = {
  id: string;
  organization_id: string;
  project_id: string;
  /**
   * short code within the project, e.g. "A", "C1"
   */
  key: string;
  name: string;
  floors: number;
  units_per_floor: number;
  handover_date: Timestamp | null;
  /**
   * @kyselyType('pre-launch' | 'launched' | 'under-construction' | 'delivered')
   */
  status: Generated<"pre-launch" | "launched" | "under-construction" | "delivered">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_commissions = {
  id: string;
  organization_id: string;
  agent_id: string;
  /**
   * first-of-month date representing the commission period
   */
  period: Timestamp;
  contracts_count: Generated<number>;
  /**
   * @kyselyType(number)
   */
  sales_value_egp: Generated<number>;
  rate_pct: string;
  /**
   * @kyselyType(number)
   */
  commission_egp: Generated<number>;
  /**
   * @kyselyType('pending' | 'approved' | 'paid')
   */
  status: Generated<"pending" | "approved" | "paid">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_contracts = {
  id: string;
  organization_id: string;
  reservation_id: string | null;
  customer_id: string;
  unit_id: string;
  /**
   * @kyselyType(number)
   */
  value_egp: number;
  signed_date: Timestamp | null;
  /**
   * @kyselyType('draft' | 'awaiting-approval' | 'signed')
   */
  status: Generated<"draft" | "awaiting-approval" | "signed">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_customer_units = {
  id: string;
  organization_id: string;
  customer_id: string;
  unit_id: string;
  created_at: Generated<Timestamp>;
};
export type realestate_customers = {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  primary_project_id: string | null;
  agent_id: string;
  /**
   * @kyselyType('active' | 'pending')
   */
  status: Generated<"active" | "pending">;
  since_date: Generated<Timestamp>;
  national_id: string | null;
  address: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_documents = {
  id: string;
  organization_id: string;
  name: string;
  doc_type: string;
  related_type: string | null;
  related_id: string | null;
  /**
   * Core `files.id` — actual bytes live in Core's FilesModule (presigned upload flow)
   */
  file_id: string | null;
  uploaded_by: string;
  /**
   * @kyselyType('draft' | 'pending' | 'verified')
   */
  status: Generated<"draft" | "pending" | "verified">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_financial_reports = {
  id: string;
  organization_id: string;
  name: string;
  /**
   * @kyselyType('collections' | 'revenue' | 'receivables' | 'commissions' | 'treasury')
   */
  type: "collections" | "revenue" | "receivables" | "commissions" | "treasury";
  period: string;
  owner_id: string;
  /**
   * @kyselyType('manual' | 'daily' | 'weekly' | 'monthly')
   */
  schedule: Generated<"manual" | "daily" | "weekly" | "monthly">;
  last_run_at: Timestamp | null;
  /**
   * @kyselyType('draft' | 'active')
   */
  status: Generated<"draft" | "active">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_followups = {
  id: string;
  organization_id: string;
  /**
   * @kyselyType('high' | 'medium' | 'low')
   */
  priority: Generated<"high" | "medium" | "low">;
  lead_id: string | null;
  customer_id: string | null;
  reason: string;
  agent_id: string;
  due_at: Timestamp;
  /**
   * @kyselyType('open' | 'in-progress' | 'overdue' | 'done')
   */
  status: Generated<"open" | "in-progress" | "overdue" | "done">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_installments = {
  id: string;
  organization_id: string;
  payment_plan_id: string;
  seq_no: number;
  label: string;
  due_date: Timestamp;
  /**
   * @kyselyType(number)
   */
  amount_egp: number;
  /**
   * @kyselyType(number)
   */
  paid_egp: Generated<number>;
  /**
   * @kyselyType('pending' | 'partial' | 'paid' | 'overdue')
   */
  status: Generated<"pending" | "partial" | "paid" | "overdue">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_leads = {
  id: string;
  organization_id: string;
  name: string;
  phone: string;
  email: string | null;
  /**
   * @kyselyType('referral' | 'website' | 'facebook' | 'broker' | 'exhibition' | 'instagram')
   */
  source: "referral" | "website" | "facebook" | "broker" | "exhibition" | "instagram";
  /**
   * @kyselyType('new' | 'qualified' | 'contacted' | 'viewing' | 'negotiation' | 'lost')
   */
  status: Generated<"new" | "qualified" | "contacted" | "viewing" | "negotiation" | "lost">;
  /**
   * Superset funnel stage backing the Pipeline kanban — see lead.domain.ts.
   * @kyselyType('new' | 'qualified' | 'contacted' | 'viewing' | 'negotiation' | 'reserved' | 'contracted' | 'sold' | 'lost')
   */
  stage: Generated<
    | "new"
    | "qualified"
    | "contacted"
    | "viewing"
    | "negotiation"
    | "reserved"
    | "contracted"
    | "sold"
    | "lost"
  >;
  score: Generated<number>;
  interest_unit_id: string | null;
  interest_text: string | null;
  /**
   * @kyselyType(number)
   */
  value_egp: Generated<number>;
  agent_id: string;
  /**
   * set once a lead is tracked as a "deal" (Sales > Deals screen)
   */
  probability_pct: string | null;
  expected_close_date: Timestamp | null;
  /**
   * Raw natural-language notes an agent typed for AI requirement extraction
   * (Lead AI Intelligence — atlas/backend/app/realestate/lead-intelligence).
   * Kept verbatim so the extraction can be re-run/audited; independent of
   * `interest_text` above, which stays a short one-line summary.
   */
  requirements_notes: string | null;
  /**
   * AI-extracted structured requirements — shape is `LeadRequirements` in
   * lead-intelligence/domain/requirements.schema.ts, parsed/validated with
   * Zod at the application boundary (same convention as `audit_logs.metadata`
   * below not being a Prisma-typed shape either). Deliberately persisted:
   * re-running the extraction costs an LLM call, and this is what the
   * deterministic matching engine reads on every "Generate Sales Brief".
   * @kyselyType(Json<Record<string, unknown>>)
   */
  requirements: Json<Record<string, unknown>> | null;
  requirements_extracted_at: Timestamp | null;
  last_activity_at: Generated<Timestamp>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_org_settings = {
  organization_id: string;
  reservation_hold_days: Generated<number>;
  escalation_days: Generated<number>;
  default_discount_pct: Generated<string>;
  ai_insight_refresh_minutes: Generated<number>;
  updated_at: Generated<Timestamp>;
};
export type realestate_payment_plans = {
  id: string;
  organization_id: string;
  contract_id: string;
  unit_id: string;
  customer_id: string;
  /**
   * @kyselyType(number)
   */
  total_egp: number;
  down_payment_pct: string;
  installment_count: number;
  /**
   * @kyselyType('monthly' | 'quarterly' | 'semi-annual' | 'annual')
   */
  cadence: Generated<"monthly" | "quarterly" | "semi-annual" | "annual">;
  start_date: Timestamp;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_payments = {
  id: string;
  organization_id: string;
  reference: string;
  customer_id: string;
  unit_id: string;
  installment_id: string | null;
  /**
   * @kyselyType(number)
   */
  amount_egp: number;
  /**
   * @kyselyType('bank-transfer' | 'cheque' | 'cash' | 'card')
   */
  method: "bank-transfer" | "cheque" | "cash" | "card";
  paid_at: Generated<Timestamp>;
  /**
   * @kyselyType('paid' | 'pending' | 'overdue')
   */
  status: Generated<"paid" | "pending" | "overdue">;
  created_at: Generated<Timestamp>;
};
export type realestate_price_lists = {
  id: string;
  organization_id: string;
  project_id: string;
  name: string;
  version: string;
  /**
   * @kyselyType(number)
   */
  base_per_sqm_egp: number;
  floor_premium_pct: Generated<string>;
  max_discount_pct: Generated<string>;
  effective_date: Timestamp;
  /**
   * @kyselyType('draft' | 'awaiting-approval' | 'active')
   */
  status: Generated<"draft" | "awaiting-approval" | "active">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_projects = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  location: string;
  developer: string;
  /**
   * @kyselyType('pre-launch' | 'launched' | 'under-construction' | 'delivered')
   */
  status: Generated<"pre-launch" | "launched" | "under-construction" | "delivered">;
  total_units: Generated<number>;
  sold_units: Generated<number>;
  reserved_units: Generated<number>;
  available_units: Generated<number>;
  /**
   * @kyselyType(number)
   */
  total_value_egp: Generated<number>;
  /**
   * @kyselyType(number)
   */
  revenue_egp: Generated<number>;
  velocity_per_week: Generated<string>;
  sell_through_pct: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_reservations = {
  id: string;
  organization_id: string;
  unit_id: string;
  customer_id: string;
  agent_id: string;
  reserved_at: Generated<Timestamp>;
  expires_at: Timestamp;
  /**
   * @kyselyType(number)
   */
  deposit_egp: number;
  /**
   * @kyselyType('active' | 'expiring' | 'expired' | 'converted')
   */
  status: Generated<"active" | "expiring" | "expired" | "converted">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_tasks = {
  id: string;
  organization_id: string;
  /**
   * @kyselyType('high' | 'medium' | 'low')
   */
  priority: Generated<"high" | "medium" | "low">;
  title: string;
  related_type: string | null;
  related_id: string | null;
  assignee_id: string;
  due_at: Timestamp;
  /**
   * @kyselyType('open' | 'in-progress' | 'done')
   */
  status: Generated<"open" | "in-progress" | "done">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_units = {
  id: string;
  organization_id: string;
  building_id: string;
  project_id: string;
  /**
   * e.g. "A-0904"
   */
  code: string;
  floor: number;
  /**
   * e.g. "1-Bed", "Penthouse"
   */
  unit_type: string;
  area_sqm: string;
  /**
   * @kyselyType(number)
   */
  base_price_egp: number;
  /**
   * @kyselyType('available' | 'reserved' | 'sold' | 'on-hold' | 'unavailable')
   */
  status: Generated<"available" | "reserved" | "sold" | "on-hold" | "unavailable">;
  current_customer_id: string | null;
  current_agent_id: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_workflow_steps = {
  id: string;
  organization_id: string;
  workflow_id: string;
  seq_no: number;
  label: string;
  assignee_id: string | null;
  /**
   * @kyselyType('done' | 'current' | 'pending')
   */
  state: Generated<"done" | "current" | "pending">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type realestate_workflows = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type RealestateTables = {
  realestate_activities: realestate_activities;
  realestate_ai_insights: realestate_ai_insights;
  realestate_approvals: realestate_approvals;
  realestate_buildings: realestate_buildings;
  realestate_commissions: realestate_commissions;
  realestate_contracts: realestate_contracts;
  realestate_customer_units: realestate_customer_units;
  realestate_customers: realestate_customers;
  realestate_documents: realestate_documents;
  realestate_financial_reports: realestate_financial_reports;
  realestate_followups: realestate_followups;
  realestate_installments: realestate_installments;
  realestate_leads: realestate_leads;
  realestate_org_settings: realestate_org_settings;
  realestate_payment_plans: realestate_payment_plans;
  realestate_payments: realestate_payments;
  realestate_price_lists: realestate_price_lists;
  realestate_projects: realestate_projects;
  realestate_reservations: realestate_reservations;
  realestate_tasks: realestate_tasks;
  realestate_units: realestate_units;
  realestate_workflow_steps: realestate_workflow_steps;
  realestate_workflows: realestate_workflows;
};
