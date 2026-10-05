import type { Json } from "../../../../../core/kernel/db/json.js";
import type { ColumnType } from "kysely";
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type raqib_action_events = {
  id: string;
  organization_id: string;
  action_id: string;
  seq: Generated<string>;
  /**
   * @kyselyType('created' | 'started' | 'submitted' | 'comment' | 'returned' | 'closed' | 'reassigned')
   */
  kind: "created" | "started" | "submitted" | "comment" | "returned" | "closed" | "reassigned";
  from_status: string | null;
  to_status: string | null;
  text: string | null;
  actor_id: string | null;
  actor_name_ar: string;
  actor_name_en: string;
  actor_role: string | null;
  actor_title_ar: Generated<string>;
  actor_title_en: Generated<string>;
  at: Generated<Timestamp>;
};
export type raqib_answers = {
  id: string;
  organization_id: string;
  inspection_id: string;
  item_id: string;
  /**
   * @kyselyType('c' | 'n' | 'x' | null)
   */
  value: "c" | "n" | "x" | null | null;
  note: string | null;
  /**
   * @kyselyType('low' | 'medium' | 'high' | null)
   */
  severity: "low" | "medium" | "high" | null | null;
  edited_round: Generated<number>;
  updated_by: string | null;
  updated_at: Generated<Timestamp>;
};
export type raqib_areas = {
  id: string;
  organization_id: string;
  site_id: string;
  name_ar: string;
  name_en: string;
  sort_order: Generated<number>;
  archived_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type raqib_corrective_actions = {
  id: string;
  organization_id: string;
  ref: string;
  observation_id: string;
  project_id: string;
  title_ar: string;
  title_en: string;
  description: Generated<string>;
  /**
   * @kyselyType('low' | 'medium' | 'high')
   */
  priority: "low" | "medium" | "high";
  responsible_id: string;
  due_date: Timestamp;
  /**
   * @kyselyType('assigned' | 'in_progress' | 'quality_review' | 'returned' | 'closed')
   */
  status: Generated<"assigned" | "in_progress" | "quality_review" | "returned" | "closed">;
  round: Generated<number>;
  created_by: string | null;
  created_at: Generated<Timestamp>;
  started_at: Timestamp | null;
  submitted_at: Timestamp | null;
  closed_at: Timestamp | null;
  overdue_notified_at: Timestamp | null;
  updated_at: Generated<Timestamp>;
};
export type raqib_counters = {
  organization_id: string;
  kind: string;
  year: number;
  value: Generated<number>;
};
export type raqib_evidence = {
  id: string;
  organization_id: string;
  file_id: string;
  /**
   * @kyselyType('photo' | 'video' | 'doc')
   */
  kind: "photo" | "video" | "doc";
  name: string;
  mime: string;
  size_bytes: string;
  /**
   * @kyselyType('answer' | 'guard_eval' | 'corrective_action' | 'observation')
   */
  context: "answer" | "guard_eval" | "corrective_action" | "observation";
  inspection_id: string | null;
  item_id: string | null;
  guard_id: string | null;
  ref_id: string | null;
  uploaded_by: string | null;
  uploaded_at: Generated<Timestamp>;
  removed_at: Timestamp | null;
};
export type raqib_form_versions = {
  id: string;
  organization_id: string;
  form_id: string;
  version: string;
  /**
   * @kyselyType('draft' | 'published' | 'archived')
   */
  status: Generated<"draft" | "published" | "archived">;
  /**
   * @kyselyType(Json<unknown[]>)
   */
  sections: Generated<Json<unknown[]>>;
  note_ar: Generated<string>;
  note_en: Generated<string>;
  created_by: string | null;
  created_at: Generated<Timestamp>;
  published_by: string | null;
  published_at: Timestamp | null;
  superseded_at: Timestamp | null;
};
export type raqib_forms = {
  id: string;
  organization_id: string;
  code: string;
  /**
   * @kyselyType('site' | 'guard')
   */
  category: "site" | "guard";
  name_ar: string;
  name_en: string;
  description_ar: Generated<string>;
  description_en: Generated<string>;
  active: Generated<boolean>;
  is_default: Generated<boolean>;
  created_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type raqib_guard_notes = {
  organization_id: string;
  inspection_id: string;
  guard_id: string;
  note: Generated<string>;
  updated_at: Generated<Timestamp>;
};
export type raqib_guard_scores = {
  organization_id: string;
  inspection_id: string;
  guard_id: string;
  item_id: string;
  score: number;
  updated_at: Generated<Timestamp>;
};
export type raqib_guards = {
  id: string;
  organization_id: string;
  project_id: string;
  user_id: string | null;
  employee_no: string;
  national_id: string;
  name_ar: string;
  name_en: string;
  post_ar: Generated<string>;
  post_en: Generated<string>;
  /**
   * @kyselyType('morning' | 'evening' | 'night')
   */
  shift: Generated<"morning" | "evening" | "night">;
  /**
   * @kyselyType('active' | 'inactive')
   */
  status: Generated<"active" | "inactive">;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type raqib_inspection_flags = {
  id: string;
  organization_id: string;
  inspection_id: string;
  item_id: string;
  round: number;
  created_by: string | null;
  created_at: Generated<Timestamp>;
};
export type raqib_inspection_items = {
  id: string;
  organization_id: string;
  inspection_id: string;
  /**
   * @kyselyType('site' | 'guard')
   */
  kind: "site" | "guard";
  section_pos: number;
  section_key: string;
  section_title_ar: string;
  section_title_en: string;
  position: number;
  item_key: string;
  text_ar: string;
  text_en: string;
  weight: number;
  answer_type: string;
  required: boolean;
  na_allowed: boolean;
  evidence_on_nc: boolean;
};
export type raqib_inspections = {
  id: string;
  organization_id: string;
  visit_id: string;
  form_version_id: string;
  guard_form_version_id: string | null;
  scoring_policy: Generated<string>;
  started_by: string | null;
  started_at: Generated<Timestamp>;
  submitted_at: Timestamp | null;
  score_pct: number | null;
  /**
   * @kyselyType(Json<Record<string, unknown>> | null)
   */
  counts: Json<Record<string, unknown>> | null | null;
};
export type raqib_observations = {
  id: string;
  organization_id: string;
  ref: string;
  /**
   * @kyselyType('violation' | 'observation')
   */
  kind: "violation" | "observation";
  project_id: string;
  site_id: string;
  visit_id: string | null;
  inspection_id: string | null;
  item_id: string | null;
  item_key: string | null;
  item_num: string | null;
  title_ar: string;
  title_en: string;
  note: Generated<string>;
  /**
   * @kyselyType('low' | 'medium' | 'high')
   */
  severity: "low" | "medium" | "high";
  repeat_count: Generated<number>;
  reported_by: string | null;
  reported_by_name_ar: string;
  reported_by_name_en: string;
  created_at: Generated<Timestamp>;
};
export type raqib_profiles = {
  organization_id: string;
  user_id: string;
  /**
   * @kyselyType('qm' | 'qe' | 'pm' | 'ins' | 'gs' | 'guard' | 'gm')
   */
  role_key: "qm" | "qe" | "pm" | "ins" | "gs" | "guard" | "gm";
  name_ar: string;
  name_en: string;
  title_ar: Generated<string>;
  title_en: Generated<string>;
  employee_no: string | null;
  phone: string | null;
  /**
   * @kyselyType('active' | 'invited' | 'disabled')
   */
  status: Generated<"active" | "invited" | "disabled">;
  last_active_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type raqib_project_assignments = {
  id: string;
  organization_id: string;
  user_id: string;
  project_id: string;
  valid_from: Timestamp;
  valid_to: Timestamp | null;
  created_by: string | null;
  ended_by: string | null;
  reason: string | null;
  created_at: Generated<Timestamp>;
};
export type raqib_projects = {
  id: string;
  organization_id: string;
  code: string;
  name_ar: string;
  name_en: string;
  city_ar: Generated<string>;
  city_en: Generated<string>;
  region_ar: Generated<string>;
  region_en: Generated<string>;
  manager_user_id: string | null;
  /**
   * @kyselyType('active' | 'attention' | 'mobilizing')
   */
  status: Generated<"active" | "attention" | "mobilizing">;
  first_visit_date: Timestamp | null;
  archived_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type raqib_reports = {
  id: string;
  organization_id: string;
  visit_id: string;
  inspection_id: string;
  project_id: string;
  ref: string;
  score_pct: number | null;
  /**
   * @kyselyType(Json<Record<string, unknown>>)
   */
  snapshot: Json<Record<string, unknown>>;
  approved_by: string | null;
  approved_by_name_ar: string;
  approved_by_name_en: string;
  generated_at: Generated<Timestamp>;
};
export type raqib_role_templates = {
  id: string;
  organization_id: string;
  /**
   * @kyselyType('qm' | 'qe' | 'pm' | 'ins' | 'gs' | 'guard' | 'gm')
   */
  role_key: "qm" | "qe" | "pm" | "ins" | "gs" | "guard" | "gm";
  module: string;
  actions: Generated<string>;
  updated_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type raqib_settings = {
  organization_id: string;
  /**
   * @kyselyType(Json<Record<string, unknown>>)
   */
  data: Generated<Json<Record<string, unknown>>>;
  updated_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type raqib_sites = {
  id: string;
  organization_id: string;
  project_id: string;
  name_ar: string;
  name_en: string;
  sort_order: Generated<number>;
  archived_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type raqib_training_events = {
  id: string;
  organization_id: string;
  request_id: string;
  seq: Generated<string>;
  /**
   * @kyselyType('requested' | 'returned' | 'resubmitted' | 'approved' | 'rejected' | 'scheduled' | 'completed')
   */
  kind:
    "requested" | "returned" | "resubmitted" | "approved" | "rejected" | "scheduled" | "completed";
  from_status: string | null;
  to_status: string;
  text: string | null;
  actor_id: string | null;
  actor_name_ar: string;
  actor_name_en: string;
  actor_role: string | null;
  actor_title_ar: Generated<string>;
  actor_title_en: Generated<string>;
  at: Generated<Timestamp>;
};
export type raqib_training_requests = {
  id: string;
  organization_id: string;
  ref: string;
  guard_id: string;
  project_id: string;
  /**
   * @kyselyType('low_score' | 'repeat_issue' | 'incident' | 'refresher' | 'new_assignment')
   */
  reason: "low_score" | "repeat_issue" | "incident" | "refresher" | "new_assignment";
  course: string;
  related: Generated<string>;
  /**
   * @kyselyType('low' | 'medium' | 'high')
   */
  priority: "low" | "medium" | "high";
  notes: Generated<string>;
  /**
   * @kyselyType('pending_pm' | 'returned' | 'rejected' | 'approved' | 'scheduled' | 'completed')
   */
  status: Generated<
    "pending_pm" | "returned" | "rejected" | "approved" | "scheduled" | "completed"
  >;
  round: Generated<number>;
  requested_by: string | null;
  scheduled_date: Timestamp | null;
  provider: string | null;
  completed_date: Timestamp | null;
  /**
   * @kyselyType('passed' | 'attended' | 'failed')
   */
  result: "passed" | "attended" | "failed" | null;
  result_note: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type raqib_visit_events = {
  id: string;
  organization_id: string;
  visit_id: string;
  seq: Generated<string>;
  /**
   * @kyselyType('scheduled' | 'assigned' | 'started' | 'submitted' | 'resubmitted' | 'reviewed' | 'returned' | 'rejected' | 'approved' | 'rescheduled' | 'cancelled')
   */
  action:
    | "scheduled"
    | "assigned"
    | "started"
    | "submitted"
    | "resubmitted"
    | "reviewed"
    | "returned"
    | "rejected"
    | "approved"
    | "rescheduled"
    | "cancelled";
  from_status: string | null;
  to_status: string;
  actor_id: string | null;
  actor_name_ar: string;
  actor_name_en: string;
  actor_role: string | null;
  actor_title_ar: Generated<string>;
  actor_title_en: Generated<string>;
  reason: string | null;
  /**
   * @kyselyType(Json<Record<string, unknown>>)
   */
  detail: Json<Record<string, unknown>> | null;
  at: Generated<Timestamp>;
};
export type raqib_visit_guards = {
  organization_id: string;
  visit_id: string;
  guard_id: string;
};
export type raqib_visits = {
  id: string;
  organization_id: string;
  ref: string;
  project_id: string;
  site_id: string;
  area_id: string | null;
  area_text: string | null;
  inspector_id: string | null;
  /**
   * @kyselyType('routine' | 'surprise' | 'follow' | 'night')
   */
  visit_type: Generated<"routine" | "surprise" | "follow" | "night">;
  /**
   * @kyselyType('morning' | 'evening' | 'night')
   */
  shift: Generated<"morning" | "evening" | "night">;
  scheduled_date: Timestamp;
  scheduled_time: string;
  /**
   * @kyselyType('scheduled' | 'assigned' | 'in_progress' | 'pending_review' | 'pending_approval' | 'returned' | 'approved' | 'rejected' | 'cancelled')
   */
  status: Generated<
    | "scheduled"
    | "assigned"
    | "in_progress"
    | "pending_review"
    | "pending_approval"
    | "returned"
    | "approved"
    | "rejected"
    | "cancelled"
  >;
  round: Generated<number>;
  overdue_notified_at: Timestamp | null;
  created_by: string | null;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
};
export type RaqibTables = {
  raqib_action_events: raqib_action_events;
  raqib_answers: raqib_answers;
  raqib_areas: raqib_areas;
  raqib_corrective_actions: raqib_corrective_actions;
  raqib_counters: raqib_counters;
  raqib_evidence: raqib_evidence;
  raqib_form_versions: raqib_form_versions;
  raqib_forms: raqib_forms;
  raqib_guard_notes: raqib_guard_notes;
  raqib_guard_scores: raqib_guard_scores;
  raqib_guards: raqib_guards;
  raqib_inspection_flags: raqib_inspection_flags;
  raqib_inspection_items: raqib_inspection_items;
  raqib_inspections: raqib_inspections;
  raqib_observations: raqib_observations;
  raqib_profiles: raqib_profiles;
  raqib_project_assignments: raqib_project_assignments;
  raqib_projects: raqib_projects;
  raqib_reports: raqib_reports;
  raqib_role_templates: raqib_role_templates;
  raqib_settings: raqib_settings;
  raqib_sites: raqib_sites;
  raqib_training_events: raqib_training_events;
  raqib_training_requests: raqib_training_requests;
  raqib_visit_events: raqib_visit_events;
  raqib_visit_guards: raqib_visit_guards;
  raqib_visits: raqib_visits;
};
