/**
 * Organization settings — the shape stored in `raqib_settings.data` and the defaults an
 * organization that has not saved settings yet runs on. Pure data + a merge, no I/O.
 */
export interface OrgSettings {
  org: { nameAr: string; nameEn: string; cr: string; cityAr: string; cityEn: string; lang: "ar" | "en"; tz: string };
  scoring: { high: number; mid: number; naExcluded: boolean; criticalFail: boolean };
  insp: { latestOnStart: boolean; publishNeedsApproval: boolean; ncNote: boolean; ncEvidence: boolean; lockAfterSubmit: boolean; overdueHours: number };
  attach: { photo: number; video: number; doc: number; types: string; videoProtected: boolean; linkMinutes: number; retention: number; compress: boolean };
  notif: Record<string, [number, number]>;
  report: { lang: "both" | "ar" | "en"; branding: boolean; evidence: boolean; signatures: boolean; history: boolean; watermark: boolean };
  security: { session: number; mfa: string; pwLen: number; pwRotate: number; lockout: number };
  audit: { retention: number; exportRoles: string };
}

export const DEFAULT_SETTINGS: OrgSettings = {
  org: { nameAr: "شركة رقيب للخدمات الأمنية", nameEn: "Raqib Security Services Co.", cr: "1010 482 991", cityAr: "الرياض", cityEn: "Riyadh", lang: "ar", tz: "Asia/Riyadh" },
  scoring: { high: 85, mid: 75, naExcluded: true, criticalFail: false },
  insp: { latestOnStart: true, publishNeedsApproval: true, ncNote: true, ncEvidence: true, lockAfterSubmit: true, overdueHours: 24 },
  attach: { photo: 25, video: 500, doc: 20, types: "JPG, PNG, HEIC, MP4, MOV, PDF", videoProtected: true, linkMinutes: 5, retention: 7, compress: true },
  notif: {
    assigned: [1, 1], changed: [1, 1], overdue: [1, 1], returned: [1, 1], decision: [1, 0],
    caAssigned: [1, 1], caOverdue: [1, 1], training: [1, 0], account: [1, 1],
  },
  report: { lang: "both", branding: true, evidence: true, signatures: true, history: true, watermark: true },
  security: { session: 30, mfa: "qm,qe,pm,gm", pwLen: 12, pwRotate: 90, lockout: 5 },
  audit: { retention: 7, exportRoles: "qm,gm" },
};

type Json = Record<string, unknown>;

/** Deep-merge saved settings over defaults (one level of nesting — settings are two levels deep). */
export function mergeSettings(saved: Json | null | undefined): OrgSettings {
  const out = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, Json>;
  if (saved) {
    for (const [sec, vals] of Object.entries(saved)) {
      if (out[sec] && vals && typeof vals === "object") Object.assign(out[sec]!, vals);
    }
  }
  return out as unknown as OrgSettings;
}

/** Flat list of changed settings keys (`section.key`) — what the audit entry records. */
export function diffSettings(before: OrgSettings, after: OrgSettings): string[] {
  const out: string[] = [];
  const b = before as unknown as Record<string, Json>;
  const a = after as unknown as Record<string, Json>;
  for (const sec of Object.keys(a)) {
    for (const k of Object.keys(a[sec]!)) {
      if (JSON.stringify(a[sec]![k]) !== JSON.stringify(b[sec]?.[k])) out.push(`${sec}.${k}`);
    }
  }
  return out;
}
