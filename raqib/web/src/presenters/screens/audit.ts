import type { Ctx } from "../context";
import { ROLE_LABEL } from "./users";

const short = (v: unknown): string => {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 220 ? `${s.slice(0, 217)}…` : s;
};

/** Filters the audit screen is showing (UI state → backend query). */
export function auditQuery(c: Ctx): {
  q: string;
  entity: string;
  actor: string;
  from: string;
  to: string;
} {
  const f = c.ui.afilters;
  return { q: f.q, entity: f.ent, actor: f.who, from: f.from, to: f.to };
}

/** The audit log (design: vmAudit): who did what to which record, with the reason and the change. */
export function auditLog(c: Ctx) {
  const { i, ui, set, me } = c;
  const data = c.data.audit;
  const f = ui.afilters;
  const patch = (k: "q" | "ent" | "who" | "from" | "to") => (e: { target: { value: string } }) =>
    set((s) => ({ afilters: { ...s.afilters, [k]: e.target.value } }));
  const rows = (data?.items ?? []).map((e) => ({
    act: e.action,
    at: i.fd(e.at, "dt"),
    ent: e.entity,
    ref: e.ref ?? "",
    who: i.L(e.actor.name),
    role: e.actor.role
      ? i.L(ROLE_LABEL[e.actor.role as keyof typeof ROLE_LABEL])
      : i.S("systemActor"),
    dev: e.correlationId ? e.correlationId.slice(0, 8) : "",
    reason: e.reason ?? "",
    hasReason: !!e.reason,
    prev: short(e.before),
    next: short(e.after),
    hasChange: e.before != null || e.after != null,
  }));
  const any = !!(f.q || f.ent || f.who || f.from || f.to);
  return {
    au: {
      q: f.q,
      onQ: patch("q"),
      ent: f.ent,
      onEnt: patch("ent"),
      who: f.who,
      onWho: patch("who"),
      from: f.from,
      onFrom: patch("from"),
      to: f.to,
      onTo: patch("to"),
      entOpts: [{ v: "", l: i.S("allEntities") }].concat(
        (data?.entities ?? []).map((x) => ({ v: x, l: x })),
      ),
      whoOpts: [{ v: "", l: i.S("allUsers") }].concat(
        (data?.actors ?? []).map((x) => ({ v: x.id, l: i.L(x.name) })),
      ),
      clear: () => set({ afilters: { q: "", ent: "", who: "", from: "", to: "" } }),
      count:
        i.S("auditCount", { n: rows.length }) +
        (data?.truncated ? ` · ${i.S("auditTruncated")}` : ""),
      rows,
      has: rows.length > 0,
      none: rows.length === 0 && !!data,
      note: any ? i.S("auditFiltered") : i.S("auditNote"),
      canExport: me.permissions.audit.includes("X"),
      exportCsv: () =>
        void c.actions.exportAudit(auditQuery(c)).catch(() => c.toast(i.S("actionFailed"))),
    },
  };
}
