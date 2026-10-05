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
