import type { Json } from "../../../../../core/kernel/db/json.js";
import type { ColumnType } from "kysely";
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

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
export type raqib_counters = {
  organization_id: string;
  kind: string;
  year: number;
  value: Generated<number>;
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
  raqib_areas: raqib_areas;
  raqib_counters: raqib_counters;
  raqib_guards: raqib_guards;
  raqib_profiles: raqib_profiles;
  raqib_project_assignments: raqib_project_assignments;
  raqib_projects: raqib_projects;
  raqib_role_templates: raqib_role_templates;
  raqib_settings: raqib_settings;
  raqib_sites: raqib_sites;
  raqib_visit_events: raqib_visit_events;
  raqib_visit_guards: raqib_visit_guards;
  raqib_visits: raqib_visits;
};
