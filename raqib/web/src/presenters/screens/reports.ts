import type { Report } from "@/api/types";
import { scoreColor } from "../common";
import type { Ctx } from "../context";
import { ROLE_LABEL } from "./users";
import { C } from "@/styles/colors";

/** Report row on the issued-reports list (design: rl). */
export function reportsIssued(c: Ctx) {
  const { i } = c;
  const items = c.data.reports?.items ?? [];
  const canPdf = c.me.permissions.reports.includes("D");
  return {
    rl: {
      types: [],
      rows: items.map((r) => ({
        rref: r.ref,
        ref: r.snapshot.visitRef,
        proj: i.L(r.snapshot.project.name),
        site: i.L(r.snapshot.site),
        approved: i.fd(r.issuedAt, "d"),
        score: r.scorePct == null ? "—" : `${r.scorePct}%`,
        scoreC: scoreColor(r.scorePct),
        go: () => c.go("report", r.visitId),
        dl: canPdf ? () => void downloadPdf(c, r, c.ui.lang) : () => c.toast(i.S("notAllowed2")),
      })),
      none: items.length === 0,
    },
  };
}

/** Trigger a browser download for bytes fetched with the caller's credentials. */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadPdf(c: Ctx, r: Report, lang: "ar" | "en"): Promise<void> {
  const { i } = c;
  c.toast(i.S("rp_preparing"));
  try {
    saveBlob(await c.actions.reportPdf(r.id, lang), `${r.ref}-${lang}.pdf`);
    c.set({ toast: null });
  } catch (e) {
    const status = (e as { status?: number }).status;
    c.toast(status === 500 || status === 503 ? i.S("rp_pdf_unavailable") : i.S("actionFailed"));
  }
}

/** The report document on screen (design: vmReport) — rendered from the frozen snapshot, in the chosen language. */
export function reportDetail(c: Ctx, r: Report) {
  const { i, ui } = c;
  const lang = ui.rlang;
  const S = (k: string, v?: Record<string, string | number>) => i.S(k, v, lang);
  const L = (x: Parameters<typeof i.L>[0]) => i.L(x, lang);
  const s = r.snapshot;
  const pct = s.score.pct;
  const rating =
    pct == null
      ? S("rp_rating_none")
      : pct >= 85
        ? S("rp_rating_high")
        : pct >= 75
          ? S("rp_rating_mid")
          : S("rp_rating_low");
  const rows = s.sections.flatMap((sec, si) => [
    { isSec: true, isQ: false, label: `${si + 1}. ${L(sec.title)}` },
    ...sec.items.map((it) => ({
      isSec: false,
      isQ: true,
      num: it.num,
      text: L(it.text),
      w: it.weight,
      res: it.answer ? S(`ans_${it.answer}`) : "—",
      resC:
        it.answer === "c"
          ? C.status.success.fg
          : it.answer === "n"
            ? C.status.danger.fg
            : C.text.secondary,
      pts: it.answer === "c" ? it.weight : it.answer === "n" ? 0 : "—",
      note: it.note,
    })),
  ]);
  const evid = s.sections.flatMap((sec) =>
    sec.items.flatMap((it) =>
      it.evidence.map((e) => ({
        kind: e.kind,
        ref: it.num,
        cap: e.name,
        hasUrl: false,
        bgImg: "none",
      })),
    ),
  );
  const roleOf = (role: string | null) =>
    role ? L(ROLE_LABEL[role as keyof typeof ROLE_LABEL]) : "";
  const sign = (action: string, key: string) => {
    const d = [...s.decisions].reverse().find((x) => x.action === action);
    return d
      ? {
          k: S(key),
          name: L(d.actor.name),
          role: `${L(d.actor.title)}`,
          at: i.fd(d.at, "dt", lang),
          hash: "",
        }
      : null;
  };
  const sigs = [
    sign("submitted", "rp_signer_inspector") ?? sign("resubmitted", "rp_signer_inspector"),
    sign("reviewed", "rp_signer_reviewer"),
    sign("approved", "rp_signer_approver"),
  ].filter((x): x is NonNullable<typeof x> => !!x);
  const canPdf = c.me.permissions.reports.includes("D");
  return {
    rp: {
      back: () => c.go("reports"),
      ref: r.ref,
      title: S("rp_title"),
      dept: S("rp_dept"),
      dir: lang === "ar" ? "rtl" : "ltr",
      printTitle: r.ref,
      status: S("rp_status_issued"),
      statusC: C.status.success.fg,
      langs: (["ar", "en"] as const).map((l) => ({
        label: l === "ar" ? "العربية" : "English",
        set: () => c.set({ rlang: l }),
        bg: lang === l ? C.brand.primary : C.surface.white,
        fg: lang === l ? C.surface.white : C.text.ink,
      })),
      meta: [
        [S("rp_visit"), s.visitRef],
        [S("rp_project"), L(s.project.name)],
        [S("rp_site"), L(s.site)],
        [S("rp_area"), s.area == null ? "—" : L(s.area)],
        [S("rp_inspector"), s.inspector ? L(s.inspector) : "—"],
        [S("rp_date"), `${i.fd(s.date, "full", lang)} ${s.time}`],
        [S("rp_signer_approver"), L(s.approvedBy.name)],
        [S("rp_score"), pct == null ? "—" : `${pct}%`],
      ].map(([k, v]) => ({ k, v })),
      shiftLabel: S("rp_shift"),
      shift: S(`sh_${s.shift}`),
      versionNote: S("rp_version", { f: s.form.code, v: s.form.version }),
      score: pct == null ? "—" : `${pct}%`,
      scoreC: scoreColor(pct),
      rating,
      counts: S("rp_counts", {
        c: s.score.compliant,
        n: s.score.nonCompliant,
        x: s.score.na,
        e: s.score.evidence,
      }),
      rows,
      hasViol: false,
      viol: [],
      hasCas: false,
      cas: [],
      noCas: false,
      hasEvid: evid.length > 0,
      evid,
      hasGuards: s.guards.length > 0,
      guards: s.guards.map((g) => ({
        name: L(g.name),
        emp: g.employeeNo,
        score: g.pct == null ? "—" : `${g.pct}%`,
      })),
      histLabel: S("rp_hist"),
      hist: s.decisions.map((d) => ({
        at: i.fd(d.at, "dt", lang),
        d: S(`h_${d.action}`),
        who: L(d.actor.name),
        role: roleOf(d.actor.role),
        reason: d.reason ?? "",
      })),
      sigs,
      footer: S("rp_footer"),
      labels: {
        logo: S("rp_logo"),
        summary: S("rp_summary"),
        item: S("rp_item"),
        w: S("rp_w"),
        res: S("rp_res"),
        pts: S("rp_pts"),
        notes: S("rp_notes"),
        viol: S("rp_viol"),
        ev: S("rp_ev"),
        ca: S("rp_ca"),
        noCA: "",
        resp: "",
        due: "",
        st: "",
        gd: S("rp_gd"),
        sig: S("rp_sig"),
        conf: S("rp_conf"),
      },
      download: canPdf ? () => void downloadPdf(c, r, lang) : () => c.toast(i.S("notAllowed2")),
      excel: () => c.toast(i.S("rp_excel_later")),
    },
  };
}
