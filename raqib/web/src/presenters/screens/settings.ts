import type { OrgSettings, RoleKey } from "@/api/types";
import { getUi } from "@/state/ui-store";
import { pickFiles } from "@/services/pick-files";
import { pBadge } from "../common";
import type { Ctx } from "../context";
import { configFields } from "./settings-config";
import { ROLE_LABEL } from "./users";
import { C } from "@/styles/colors";

type Sec = keyof OrgSettings;
type Draft = Record<string, Record<string, unknown>>;

interface FieldOpts {
  unit?: string;
  opts?: Array<{ v: string; l: string }>;
  labelKey?: string;
  val?: unknown;
  /** Custom read/write for fields that map onto language-specific columns. */
  read?: (cur: Draft) => unknown;
  write?: (cur: Draft, v: unknown) => Draft;
}

/**
 * Organization settings (design: vmSettings). The draft lives in UI state (`setd`); saving opens the reason
 * dialog and sends the whole object to the backend, which validates ranges and records what changed.
 */
export function settingsScreen(c: Ctx) {
  const { i, ui, set, data } = c;
  const saved = data.settings as unknown as Draft | undefined;
  const cur = (ui.setd ?? saved ?? {}) as Draft;
  const tab = ui.stab || "org";
  const ro = !c.me.permissions.settings.includes("E");
  const lang = i.lang;

  const upd = (sec: string, k: string, val: unknown) => {
    const base = JSON.parse(JSON.stringify(getUi().setd ?? saved)) as Draft;
    base[sec]![k] = val;
    set({ setd: base });
  };

  const F = (
    kind: "text" | "num" | "tog" | "sel" | "info" | "pair" | "chips",
    sec: Sec,
    k: string,
    extra: FieldOpts = {},
  ) => {
    const raw = extra.read ? extra.read(cur) : cur[sec]?.[k];
    const v = extra.val !== undefined ? extra.val : raw;
    const labelKey = extra.labelKey ?? `sf_${sec}_${k}`;
    const helpKey = `sh_${sec}_${k}`;
    const writeVal = (val: unknown) => {
      if (extra.write)
        set({ setd: extra.write(JSON.parse(JSON.stringify(getUi().setd ?? saved)) as Draft, val) });
      else upd(sec, k, val);
    };
    const o: Record<string, unknown> = {
      kind,
      label: i.S(labelKey),
      help: "",
      val: v,
      on: v === true,
      ro,
      opts: extra.opts,
      unit: extra.unit,
      isText: kind === "text",
      isNum: kind === "num",
      isTog: kind === "tog",
      isSel: kind === "sel",
      isInfo: kind === "info",
      isPair: kind === "pair",
      isChips: kind === "chips",
      hasHelp: false,
      onText: (e: { target: { value: string } }) =>
        writeVal(kind === "num" ? Number(e.target.value) : e.target.value),
      toggle: () => {
        if (!ro) upd(sec, k, !raw);
      },
      tbg: raw ? C.brand.primary : C.border.strong,
      tpos: raw ? "flex-end" : "flex-start",
    };
    void helpKey;
    if (kind === "pair") {
      const pair = (raw as number[]) ?? [0, 0];
      o.pair = [0, 1].map((idx) => ({
        l: i.S(idx ? "ch_email" : "ch_app"),
        on: !!pair[idx],
        bg: pair[idx] ? C.brand.primary : C.border.strong,
        pos: pair[idx] ? "flex-end" : "flex-start",
        toggle: () => {
          if (ro) return;
          const n = [...pair];
          n[idx] = n[idx] ? 0 : 1;
          upd(sec, k, n);
        },
      }));
    }
    if (kind === "chips") {
      const list = String(raw ?? "")
        .split(",")
        .filter(Boolean);
      o.chips = (["qm", "qe", "pm", "ins", "gs", "gm"] as RoleKey[]).map((r) => ({
        l: i.L(ROLE_LABEL[r]),
        bg: list.includes(r) ? C.text.ink : C.surface.white,
        fg: list.includes(r) ? C.surface.white : C.text.body,
        toggle: () => {
          if (ro) return;
          upd(
            sec,
            k,
            (list.includes(r) ? list.filter((x) => x !== r) : list.concat([r])).join(","),
          );
        },
      }));
    }
    return o;
  };

  const { scheduleFields, escalationFields, deductionFields } = configFields(c, cur, saved, ro);

  const langOpts = [
    { v: "ar", l: "العربية" },
    { v: "en", l: "English" },
  ];
  const orgName = {
    labelKey: "sf_org_name",
    read: (d: Draft) => (lang === "ar" ? d.org!.nameAr : d.org!.nameEn),
    write: (d: Draft, v: unknown) => {
      d.org![lang === "ar" ? "nameAr" : "nameEn"] = v;
      return d;
    },
  };
  const orgCity = {
    labelKey: "sf_org_city",
    read: (d: Draft) => (lang === "ar" ? d.org!.cityAr : d.org!.cityEn),
    write: (d: Draft, v: unknown) => {
      d.org![lang === "ar" ? "cityAr" : "cityEn"] = v;
      return d;
    },
  };

  const secs: Record<string, unknown[]> = {
    org: [
      F("text", "org", "name", orgName),
      F("text", "org", "cr"),
      F("text", "org", "city", orgCity),
      F("sel", "org", "lang", { opts: langOpts }),
      F("info", "org", "tz"),
      F("info", "org", "cal", { val: i.S("gregorian") }),
      {
        ...F("info", "org", "logo", { labelKey: "sf_org_logo" }),
        isInfo: false,
        isBtn: true,
        btnLabel: i.S(cur.org?.logo ? "logoReplace" : "logoUpload"),
        btnDisabled: ro,
        // the logo is a stored file; its id is saved with the other settings (and printed on every document)
        onClick: () =>
          pickFiles("image/png,image/jpeg", false, (picked) => {
            const file = picked[0];
            if (!file) return;
            c.actions
              .confUpload(file, () => undefined)
              .then((id) => upd("org", "logo", id))
              .catch(() => c.toast(i.S("actionFailed")));
          }),
      },
    ],
    scoring: [
      F("num", "scoring", "high", { unit: "%" }),
      F("num", "scoring", "mid", { unit: "%" }),
      F("tog", "scoring", "naExcluded"),
      F("tog", "scoring", "criticalFail"),
      ...deductionFields,
    ],
    schedule: scheduleFields,
    escalation: escalationFields,
    training: [F("tog", "training", "guardReviewBySupervisor")],
    ranking: (["observations", "improvement", "complaints", "contract"] as const).map((k) =>
      F("num", "ranking", k, {
        labelKey: `sf_ranking_${k}`,
        read: (d: Draft) => (d.ranking!.weights as Record<string, number>)[k],
        write: (d: Draft, v: unknown) => {
          (d.ranking!.weights as Record<string, unknown>)[k] = Math.max(0, Number(v) || 0);
          return d;
        },
      }),
    ),
    forms: [
      F("tog", "insp", "latestOnStart"),
      F("tog", "insp", "publishNeedsApproval"),
      F("tog", "insp", "ncNote"),
      F("tog", "insp", "ncEvidence"),
      F("tog", "insp", "lockAfterSubmit"),
      F("num", "insp", "overdueHours", { unit: i.S("u_hours") }),
    ],
    notifications: Object.keys(cur.notif ?? {}).map((k) => F("pair", "notif", k)),
    reports: [
      F("sel", "report", "lang", { opts: [{ v: "both", l: i.S("bothLangs") }, ...langOpts] }),
      F("tog", "report", "branding"),
      F("tog", "report", "evidence"),
      F("tog", "report", "signatures"),
      F("tog", "report", "history"),
      F("tog", "report", "watermark"),
    ],
    attachments: [
      F("num", "attach", "photo", { unit: "MB" }),
      F("num", "attach", "video", { unit: "MB" }),
      F("num", "attach", "doc", { unit: "MB" }),
      F("text", "attach", "types"),
      F("tog", "attach", "videoProtected"),
      F("num", "attach", "linkMinutes", { unit: i.S("u_min") }),
      F("num", "attach", "retention", { unit: i.S("u_years") }),
      F("tog", "attach", "compress"),
    ],
    language: [
      F("sel", "org", "lang", { opts: langOpts }),
      F("info", "org", "cal", { val: i.S("gregorian") }),
      { ...F("info", "org", "tz"), label: i.S("sf_numerals"), val: i.S("westernDigits") },
    ],
    security: [
      F("num", "security", "session", { unit: i.S("u_min") }),
      F("chips", "security", "mfa"),
      F("num", "security", "pwLen"),
      F("num", "security", "pwRotate", { unit: i.S("u_days") }),
      F("num", "security", "lockout"),
    ],
    audit: [
      F("num", "audit", "retention", { unit: i.S("u_years") }),
      F("chips", "audit", "exportRoles"),
      {
        ...F("info", "audit", "retention"),
        label: i.S("sf_audit_immutable"),
        val: i.S("immutableTxt"),
      },
    ],
  };

  const links: Record<string, string> = {
    users: "users",
    roles: "permissions",
    permissions: "permissions",
  };
  const nav = [
    "org",
    "projects",
    "forms",
    "training",
    "ranking",
    "scoring",
    "schedule",
    "escalation",
    "notifications",
    "reports",
    "attachments",
    "language",
    "users",
    "roles",
    "permissions",
    "security",
    "audit",
  ];
  const visibleNav = nav.filter(
    (k) =>
      !links[k] ||
      ["users", "permissions"].some(
        (m) =>
          (m === "users"
            ? c.me.permissions.users.includes("V")
            : c.me.permissions.permissions.includes("V")) && links[k] === m,
      ),
  );
  const dirty = !!ui.setd && JSON.stringify(ui.setd) !== JSON.stringify(saved);
  const nDiff = dirty
    ? Object.keys(ui.setd!).reduce(
        (a, k) =>
          a +
          Object.keys(ui.setd![k]!).filter(
            (x) => JSON.stringify(ui.setd![k]![x]) !== JSON.stringify(saved?.[k]?.[x]),
          ).length,
        0,
      )
    : 0;
  const arrow = i.lang === "ar" ? "←" : "→";

  return {
    sv: {
      nav: visibleNav.map((k) => ({
        label: i.S(`set_${k}`),
        go: () => (links[k] ? c.go(links[k]!) : set({ stab: k })),
        bg: tab === k ? C.brand.wash : "transparent",
        fg: tab === k ? C.brand.primaryDark : C.text.ink,
        ext: !!links[k],
        arr: links[k] ? arrow : "",
      })),
      navOpts: visibleNav.filter((k) => !links[k]).map((k) => ({ v: k, l: i.S(`set_${k}`) })),
      tab,
      onTab: (e: { target: { value: string } }) => set({ stab: e.target.value }),
      title: i.S(`set_${tab}`),
      desc: i.S(`setd_${tab}`),
      fields: secs[tab] ?? [],
      isProjects: tab === "projects",
      projects: (data.projects ?? []).map((p) => ({
        name: i.L(p.name),
        code: p.code,
        st: pBadge(i, p.status),
        sites: i.S("nSites", { n: p.sites.length }),
        mgr: p.manager ? i.L(p.manager.name) : "—",
        go: () => c.go("project", p.id),
      })),
      isBackup: false,
      ro,
      editable: !ro && tab !== "projects",
      dirty,
      nDiff: i.S("nChanges", { n: nDiff }),
      save: () =>
        c.openModal("settingsSave", {
          n: nDiff,
          diff: [{ t: `${i.S(`set_${tab}`)} · ${i.S("nChanges", { n: nDiff })}` }],
        }),
      discard: () => set({ setd: null }),
      roTxt: i.S("settingsRO"),
    },
    setCols: c.mobile ? "minmax(0,1fr)" : "230px minmax(0,1fr)",
  };
}
