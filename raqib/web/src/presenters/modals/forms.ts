import type { Ctx } from "../context";
import type { FormField } from "@/ui/form-field";

type Fld = (k: string) => Pick<FormField, "val" | "on" | "bd" | "err">;

/** The dialogs that collect data rather than a reason: projects, sites, areas and the guard roster. */
export const FORM_KINDS = [
  "projNew",
  "projEdit",
  "siteAdd",
  "siteRename",
  "areaAdd",
  "guardNew",
  "guardEdit",
  "formNew",
  "formRename",
  "obsNew",
  "userEdit",
  "caReassign",
] as const;
/** Yes/no dialogs about one record. */
export const CONFIRM_KINDS = [
  "siteArchive",
  "areaArchive",
  "guardOff",
  "guardOn",
  "userMfaReset",
] as const;

export const isFormKind = (k: string) => (FORM_KINDS as readonly string[]).includes(k);

/** The two name boxes every named thing gets: Arabic and English, because both are printed on the reports. */
const names = (
  c: Ctx,
  fld: Fld,
  ar = "nameAr",
  en = "nameEn",
  labels: [string, string] = ["pf_nameAr", "pf_nameEn"],
): FormField[] => [
  { key: ar, label: c.i.S(labels[0]), type: "text", ...fld(ar), half: true },
  { key: en, label: c.i.S(labels[1]), type: "text", ...fld(en), half: true, ltr: true },
];

/** Who can be a project's manager: active people in the project-manager role. */
export const managerOptions = (c: Ctx) => [
  { v: "", l: c.i.S("unassigned") },
  ...(c.data.users ?? [])
    .filter((u) => u.role === "pm" && u.status !== "disabled")
    .map((u) => ({ v: u.id, l: c.i.L(u.name) })),
];

/** Guard-role accounts that are free to link: not disabled and not already tied to another guard (the one being edited stays). */
export const accountOptions = (c: Ctx, keep: string) => {
  const taken = new Set(
    (c.data.guards ?? []).map((g) => g.userId).filter((v): v is string => !!v && v !== keep),
  );
  return [
    { v: "", l: c.i.S("pf_noAccount") },
    ...(c.data.users ?? [])
      .filter((u) => u.role === "guard" && u.status !== "disabled" && !taken.has(u.id))
      .map((u) => ({ v: u.id, l: `${c.i.L(u.name)}${u.employeeNo ? ` · ${u.employeeNo}` : ""}` })),
  ];
};

export function formFields(c: Ctx, kind: string, fld: Fld): FormField[] {
  const { i } = c;
  switch (kind) {
    case "projNew":
    case "projEdit":
      return [
        ...(kind === "projNew"
          ? [
              {
                key: "code",
                label: i.S("pf_code"),
                type: "text" as const,
                ...fld("code"),
                ltr: true,
                placeholder: "PRJ-RYD-020",
                hint: i.S("pf_codeHint"),
              },
            ]
          : []),
        ...names(c, fld),
        ...names(c, fld, "cityAr", "cityEn", ["pf_cityAr", "pf_cityEn"]),
        ...names(c, fld, "regionAr", "regionEn", ["pf_regionAr", "pf_regionEn"]),
        {
          key: "mgr",
          label: i.S("pf_manager"),
          type: "select",
          ...fld("mgr"),
          opts: managerOptions(c),
        },
        {
          key: "pstatus",
          label: i.S("pf_status"),
          type: "select",
          ...fld("pstatus"),
          opts: ["mobilizing", "active", "attention", "closed"].map((k) => ({
            v: k,
            l: i.S(`ps_${k}`),
          })),
          half: true,
        },
        { key: "first", label: i.S("pf_firstVisit"), type: "date", ...fld("first"), half: true },
      ];
    case "siteAdd":
    case "siteRename":
    case "areaAdd":
      return names(c, fld);
    case "guardNew":
    case "guardEdit": {
      const keep = String(c.ui.modal?.account ?? "");
      return [
        {
          key: "gproj",
          label: i.S("f_project"),
          type: "select",
          ...fld("gproj"),
          opts: [
            { v: "", l: i.S("choose") },
            ...(c.data.projects ?? []).map((p) => ({ v: p.id, l: i.L(p.name) })),
          ],
        },
        ...(kind === "guardNew"
          ? [
              {
                key: "emp",
                label: i.S("pf_empNo"),
                type: "text" as const,
                ...fld("emp"),
                ltr: true,
                placeholder: "G-10501",
                half: true,
              },
            ]
          : []),
        {
          key: "nid",
          label: i.S("pf_nid"),
          type: "text",
          ...fld("nid"),
          ltr: true,
          half: kind === "guardNew",
          placeholder: kind === "guardEdit" ? "••••••••••" : "10 digits",
          hint: kind === "guardEdit" ? i.S("pf_nidKeep") : i.S("pf_nidHint"),
        },
        ...names(c, fld),
        ...names(c, fld, "postAr", "postEn", ["pf_postAr", "pf_postEn"]),
        {
          key: "gshift",
          label: i.S("f_shift"),
          type: "select",
          ...fld("gshift"),
          opts: ["morning", "evening", "night"].map((k) => ({ v: k, l: i.S(`sh_${k}`) })),
          half: true,
        },
        {
          key: "gacct",
          label: i.S("pf_account"),
          type: "select",
          ...fld("gacct"),
          opts: accountOptions(c, keep),
          hint: i.S("pf_accountHint"),
        },
      ];
    }
    case "formNew":
      return [
        {
          key: "fcode",
          label: i.S("pf_formCode"),
          type: "text",
          ...fld("fcode"),
          ltr: true,
          placeholder: "FRM-SITE-02",
          hint: i.S("pf_codeHint"),
        },
        {
          key: "fcat",
          label: i.S("pf_formCat"),
          type: "select",
          ...fld("fcat"),
          opts: ["site", "guard"].map((k) => ({ v: k, l: i.S(`fc_${k}`) })),
        },
        ...names(c, fld),
      ];
    case "formRename":
      return names(c, fld);
    case "obsNew": {
      const project = (c.data.projects ?? []).find((p) => p.id === c.ui.mf.oproj);
      const pick = fld("oproj");
      return [
        {
          key: "oproj",
          label: i.S("f_project"),
          type: "select",
          ...pick,
          on: (e: unknown) => {
            pick.on(e);
            c.set((s) => ({ mf: { ...s.mf, osite: "" } }));
          },
          opts: [
            { v: "", l: i.S("choose") },
            ...(c.data.projects ?? []).map((p) => ({ v: p.id, l: i.L(p.name) })),
          ],
        },
        {
          key: "osite",
          label: i.S("f_site"),
          type: "select",
          ...fld("osite"),
          opts: [
            { v: "", l: i.S("choose") },
            ...(project?.sites ?? []).map((s) => ({ v: s.id, l: i.L(s.name) })),
          ],
        },
        {
          key: "osev",
          label: i.S("severity"),
          type: "select",
          ...fld("osev"),
          opts: ["low", "medium", "high"].map((k) => ({ v: k, l: i.S(`sev_${k}`) })),
        },
        {
          key: "otext",
          label: i.S("pf_obsText"),
          type: "textarea",
          ...fld("otext"),
          placeholder: i.S("pf_obsTextPh"),
        },
        { key: "onote", label: i.S("pf_obsNote"), type: "textarea", ...fld("onote") },
      ];
    }
    case "userEdit":
      return [
        ...names(c, fld),
        ...names(c, fld, "titleAr", "titleEn", ["pf_titleAr", "pf_titleEn"]),
        {
          key: "phone",
          label: i.S("f_phone"),
          type: "text",
          ...fld("phone"),
          ltr: true,
          half: true,
        },
        {
          key: "empNo",
          label: i.S("pf_empNo"),
          type: "text",
          ...fld("empNo"),
          ltr: true,
          half: true,
        },
      ];
    case "caReassign":
      return [
        {
          key: "resp",
          label: i.S("f_resp"),
          type: "select",
          ...fld("resp"),
          opts: (c.data.responsibles ?? []).map((x) => ({ v: x.id, l: i.L(x.name) })),
        },
        { key: "due", label: i.S("f_due"), type: "date", ...fld("due") },
      ];
    default:
      return [];
  }
}
