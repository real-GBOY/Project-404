import { ApiError } from "@/services/http";
import type { ModalHandlers } from "./types";

const num = (v: unknown): number | undefined => {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : NaN;
};

/** "q9 = 12" per line: an amount for one item that overrides its severity amount. */
export function parseItemAmounts(text: unknown): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([A-Za-z0-9_.-]{1,80})\s*[=:]\s*(\d{1,3})$/.exec(line);
    if (!m || Number(m[2]) > 100) return null;
    out[m[1]!] = Number(m[2]);
  }
  return out;
}

export const scoringHandlers: ModalHandlers = {
  async scoringRules({ c, f, reason }) {
    const sev = { low: num(f.sevLow), medium: num(f.sevMed), high: num(f.sevHigh) };
    const items = parseItemAmounts(f.items);
    if (Object.values(sev).some((v) => Number.isNaN(v)) || !items) {
      c.toast(c.i.S("scoringInvalid"));
      throw new Error("invalid scoring values");
    }
    const bySeverity = Object.fromEntries(
      Object.entries(sev).filter(([, v]) => v !== undefined),
    ) as Record<string, number>;
    try {
      await c.actions.publishScoring({ bySeverity, byItem: items, reason });
    } catch (e) {
      if (e instanceof ApiError && e.code === "raqib.not_scoring_admin")
        c.toast(c.i.S("scoringNotAdmin"));
      throw e;
    }
    c.toast(c.i.S("toastScoringPublished"));
  },
  async scoringDesignate({ c, f }) {
    await c.actions.designateScoring(String(f.duser));
    c.toast(c.i.S("toastScoringDesignated"));
  },
};
