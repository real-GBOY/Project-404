/** Organization settings and the editable permission templates. */
import type { Lang } from "./common";
import type { ModuleKey, RoleKey, Template } from "./identity";

export interface OrgSettings {
  org: {
    nameAr: string;
    nameEn: string;
    cr: string;
    cityAr: string;
    cityEn: string;
    lang: Lang;
    tz: string;
    /** Core file id of the logo ("" until supplied). */
    logo: string;
  };
  scoring: { high: number; mid: number; naExcluded: boolean; criticalFail: boolean };
  insp: {
    latestOnStart: boolean;
    publishNeedsApproval: boolean;
    ncNote: boolean;
    ncEvidence: boolean;
    lockAfterSubmit: boolean;
    overdueHours: number;
  };
  attach: {
    photo: number;
    video: number;
    doc: number;
    types: string;
    videoProtected: boolean;
    linkMinutes: number;
    retention: number;
    compress: boolean;
  };
  notif: Record<string, [number, number]>;
  report: {
    lang: "both" | Lang;
    branding: boolean;
    evidence: boolean;
    signatures: boolean;
    history: boolean;
    watermark: boolean;
  };
  security: { session: number; mfa: string; pwLen: number; pwRotate: number; lockout: number };
  audit: { retention: number; exportRoles: string };
  ranking: {
    weights: { observations: number; improvement: number; complaints: number; contract: number };
  };
  training: { guardReviewBySupervisor: boolean };
  escalation: {
    enabled: boolean;
    countFrom: "assigned" | "due";
    weekend: number[];
    levels: Array<{ days: number; roles: string[] }>;
    highSeverity: { immediate: boolean; roles: string[] };
  };
  schedule: {
    shifts: Array<{ key: string; nameAr: string; nameEn: string; start: string; end: string }>;
    minRestHours: number;
    maxConsecutiveDays: number;
  };
}

/** The deduction rules and who may change them (`GET /raqib/scoring`). */
export interface ScoringConfigView {
  id: string;
  version: number;
  base: number;
  bySeverity: Record<string, number>;
  byItem: Record<string, number>;
  reason: string;
  createdAt: string;
}
export interface ScoringOverview {
  /** `null` until the client's deduction values are entered; the previous weighted policy scores meanwhile. */
  current: ScoringConfigView | null;
  history: ScoringConfigView[];
  canPublish: boolean;
  designees: Array<{ userId: string; name: { ar: string; en: string }; at: string }>;
  /** General Manager only: who could be named. */
  candidates: Array<{ userId: string; name: { ar: string; en: string }; role: string }>;
}

export interface PermissionsOverview {
  roles: Record<RoleKey, Template>;
  defaults: Record<RoleKey, Template>;
  modules: ModuleKey[];
  actions: string[];
  applicable: Record<ModuleKey, string>;
}

export interface TemplateChange {
  role: RoleKey;
  module: ModuleKey;
  actions: string;
}
