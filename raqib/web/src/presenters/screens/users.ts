import type { Person, RoleKey } from "@/api/types";
import { badge } from "../common";
import type { Ctx } from "../context";

const ROLES: RoleKey[] = ["qm", "qe", "pm", "ins", "gs", "guard", "gm"];
const US_TONE: Record<string, string> = { active: "ok", invited: "info", disabled: "neu" };

/** Display label of a role — from the role-specific nav strings is not needed here; roles are fixed. */
export const ROLE_LABEL: Record<RoleKey, { ar: string; en: string }> = {
  qm: { ar: "إدارة الجودة", en: "Quality Management" },
  qe: { ar: "موظف جودة", en: "Quality Employee" },
  pm: { ar: "مدير مشروع", en: "Project Manager" },
  ins: { ar: "مفتش", en: "Inspector" },
  gs: { ar: "مشرف حراسات", en: "Guards Supervisor" },
  guard: { ar: "حارس أمن", en: "Security Guard" },
  gm: { ar: "الإدارة العليا", en: "Executive management" },
};

const scopeText = (c: Ctx, u: Person): string => {
  if (u.scope === "all") return c.i.S("allProjects");
  const byId = new Map((c.data.projects ?? []).map((p) => [p.id, p]));
  return u.scope.length ? u.scope.map((id) => byId.get(id)?.code ?? id).join(" · ") : "—";
};

/** Users list (design: vmUsers). The account-requests tab arrives with the onboarding phase. */
export function usersList(c: Ctx) {
  const { i, ui, set, data } = c;
  const q = ui.ufilter.q.toLowerCase();
  const users = (data.users ?? []).filter(
    (u) =>
      (ui.ufilter.role === "all" || u.role === ui.ufilter.role) &&
      (!q || [u.name.ar, u.name.en, u.email].some((x) => x.toLowerCase().includes(q))),
  );
  const rows = users.map((u) => ({
    name: i.L(u.name),
    ini: i.L(u.ini),
    title: i.L(u.title),
    role: i.L(ROLE_LABEL[u.role]),
    scope: scopeText(c, u),
    st: badge(i.S(`us_${u.status}`), US_TONE[u.status] ?? "neu"),
    last: u.lastActiveAt ? i.fd(u.lastActiveAt, "dt") : "—",
    email: u.email,
    go: () => c.go("user", u.id),
  }));
  const tabs = [{ label: i.S("ut_users"), n: String((data.users ?? []).length), go: () => set({ utab: "users" }), fg: "#191C1F", bd: "#0F5C4A", fw: "600" }];
  return {
    ul: {
      tabs,
      isUsers: true,
      isReqs: false,
      rows,
      reqs: [],
      q: ui.ufilter.q,
      onQ: (e: { target: { value: string } }) => set((s) => ({ ufilter: { ...s.ufilter, q: e.target.value } })),
      role: ui.ufilter.role,
      onRole: (e: { target: { value: string } }) => set((s) => ({ ufilter: { ...s.ufilter, role: e.target.value } })),
      roleOpts: [{ v: "all", l: i.S("allRoles") }].concat(ROLES.map((k) => ({ v: k, l: i.L(ROLE_LABEL[k]) }))),
      none: !rows.length,
    },
  };
}

/** User detail (design: vmUser). */
export function userDetail(c: Ctx, u: Person) {
  const { i, data } = c;
  const tpl = data.permissions?.roles[u.role];
  const moduleOrder = data.permissions?.modules ?? [];
  const canEdit = c.me.permissions.users.includes("E") && u.role !== "qm" && u.id !== c.me.id;
  const byId = new Map((data.projects ?? []).map((p) => [p.id, p]));
  const scope =
    u.scope === "all"
      ? [`${i.S("allProjects")} — ${i.S("roleRule")}`]
      : u.scope.map((id) => (byId.get(id) ? `${i.L(byId.get(id)!.name)} · ${byId.get(id)!.code}` : id));
  return {
    ud: {
      name: i.L(u.name),
      ini: i.L(u.ini),
      title: i.L(u.title),
      role: i.L(ROLE_LABEL[u.role]),
      st: badge(i.S(`us_${u.status}`), US_TONE[u.status] ?? "neu"),
      email: u.email || "—",
      last: u.lastActiveAt ? i.fd(u.lastActiveAt, "dt") : i.S("never"),
      scope,
      noScope: u.scope !== "all" && !u.scope.length,
      scopeRule: "",
      perms: tpl
        ? moduleOrder.filter((m) => tpl[m]).map((m) => ({ mod: i.S(`pm_${m}`), acts: [...tpl[m]].map((a) => i.S(`pa_${a}`)).join(" · ") }))
        : [],
      conf: i.S("confNone"),
      acts: [],
      hasActs: false,
      noActs: true,
      canEdit,
      isInvited: u.status === "invited",
      invitedTxt: i.S("invitedTxt", { e: u.email }),
      changeRole: () => c.openModal("roleChange", { uid: u.id, ref: i.L(u.name) }, { role: u.role }),
      editScope: () => c.openModal("userScope", { uid: u.id, ref: i.L(u.name) }, { projects: u.scope === "all" ? [] : [...u.scope] }),
      toggleStatus: () => c.openModal(u.status === "disabled" ? "userEnable" : "userDisable", { uid: u.id, ref: i.L(u.name) }),
      statusLabel: u.status === "disabled" ? i.S("enableUser") : i.S("disableUser"),
      canScope: u.scope !== "all",
      back: () => c.go("users"),
    },
  };
}
