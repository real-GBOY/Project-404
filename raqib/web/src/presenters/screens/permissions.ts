import type { ModuleKey, RoleKey } from "@/api/types";
import { seg } from "../common";
import type { Ctx } from "../context";
import { ROLE_LABEL } from "./users";
import { C } from "@/styles/colors";

const ROLES: RoleKey[] = ["qm", "qe", "pm", "ins", "gs", "guard", "gm", "adm"];

type Matrix = Record<string, Record<string, string>>;

/**
 * Permission templates (design: vmPerms). Edits are staged in UI state (`permDraft`, `scopeDraft`); saving
 * opens the reason dialog, then sends ONE batch to the backend, which validates, audits and applies it.
 * The confidential-grants tab joins in the confidential phase.
 */
export function permissionTemplates(c: Ctx) {
  const { i, ui, set, data } = c;
  const ov = data.permissions;
  const tab = ui.ptab2 === "conf" ? "roles" : ui.ptab2 || "roles";
  const role = ui.prole || "qm";
  const canEdit = c.me.permissions.permissions.includes("E");
  const src: Matrix = (ui.permEdit ? ui.permDraft : ov?.roles) ?? {};
  const modules = ov?.modules ?? [];
  const actions = ov?.actions ?? [];

  const rows = modules.map((m) => ({
    mod: i.S(`pm_${m}`),
    cells: actions.map((a) => {
      const app = ov!.applicable[m].includes(a);
      const on = (src[role]?.[m] ?? "").includes(a);
      return {
        app,
        na: !app,
        on,
        mark: on ? "✓" : "",
        bg: on ? C.brand.primary : C.surface.white,
        bd: on ? C.brand.primary : C.border.strong,
        cur: ui.permEdit ? "pointer" : "default",
        toggle: () => {
          if (!ui.permEdit || !app || !ui.permDraft) return;
          const d: Matrix = JSON.parse(JSON.stringify(ui.permDraft));
          const cur = d[role]![m] ?? "";
          d[role]![m] = cur.includes(a)
            ? cur.replace(a, "")
            : actions.filter((x) => (cur + a).includes(x)).join("");
          set({ permDraft: d });
        },
      };
    }),
  }));

  // staged template changes → the batch the backend receives and the diff the dialog shows
  const changes: Array<{ role: RoleKey; module: ModuleKey; actions: string }> = [];
  const diff: Array<{ t: string; ref: string; prev: string; next: string; c: string }> = [];
  if (ui.permEdit && ui.permDraft && ov) {
    for (const r of ROLES) {
      for (const m of modules) {
        const before = ov.roles[r][m];
        const after = ui.permDraft[r]?.[m] ?? "";
        if (before !== after) changes.push({ role: r, module: m, actions: after });
        for (const a of actions) {
          const was = before.includes(a);
          const now = after.includes(a);
          if (was !== now) {
            const ref = `${i.L(ROLE_LABEL[r])} · ${i.S(`pm_${m}`)} · ${i.S(`pa_${a}`)}`;
            diff.push({
              t: `${ref}: ${now ? i.S("on") : i.S("off")}`,
              ref,
              prev: was ? i.S("on") : i.S("off"),
              next: now ? i.S("on") : i.S("off"),
              c: now ? C.status.success.fg : C.status.danger.fg,
            });
          }
        }
      }
    }
  }

  // project scope matrix (people whose scope is by assignment)
  const staff = (data.users ?? []).filter(
    (u) => !["guard", "qm", "gm"].includes(u.role) && u.status !== "disabled",
  );
  const sd = ui.scopeEdit ? ui.scopeDraft : null;
  const projects = data.projects ?? [];
  const scopeOf = (u: (typeof staff)[number]): string[] => (u.scope === "all" ? [] : u.scope);
  const scopeRows = staff.map((u) => ({
    name: i.L(u.name),
    role: i.L(ROLE_LABEL[u.role]),
    cells: projects.map((p) => {
      const has = sd ? (sd[u.id] ?? []).includes(p.id) : scopeOf(u).includes(p.id);
      return {
        on: has,
        mark: has ? "✓" : "",
        bg: has ? C.brand.primary : C.surface.white,
        bd: has ? C.brand.primary : C.border.strong,
        toggle: () => {
          if (!ui.scopeEdit || !ui.scopeDraft) return;
          const d = { ...ui.scopeDraft };
          const cur = d[u.id] ?? [];
          d[u.id] = cur.includes(p.id) ? cur.filter((x) => x !== p.id) : cur.concat([p.id]);
          set({ scopeDraft: d });
        },
      };
    }),
  }));
  const scopeChanges: Array<{ userId: string; projectIds: string[] }> = [];
  const sdiff: Array<{ t: string; c: string }> = [];
  if (sd) {
    for (const u of staff) {
      const a = scopeOf(u);
      const b = sd[u.id] ?? [];
      let changed = false;
      for (const p of projects) {
        if (a.includes(p.id) !== b.includes(p.id)) {
          changed = true;
          sdiff.push({
            t: `${i.L(u.name)} · ${p.code}: ${b.includes(p.id) ? i.S("added") : i.S("removed")}`,
            c: b.includes(p.id) ? C.status.success.fg : C.status.danger.fg,
          });
        }
      }
      if (changed) scopeChanges.push({ userId: u.id, projectIds: b });
    }
  }

  const tabs = ["roles", "scope"].map((k) => ({
    label: i.S(`pt2_${k}`),
    go: () => set({ ptab2: k }),
    fg: tab === k ? C.text.ink : C.text.secondary,
    bd: tab === k ? C.brand.primary : "transparent",
    fw: tab === k ? "600" : "500",
  }));

  return {
    pv: {
      tabs,
      isRoles: tab === "roles",
      isScope: tab === "scope",
      isConf: false,
      roles: ROLES.map((k) => seg(role, k, i.L(ROLE_LABEL[k]), () => set({ prole: k }))),
      acts: actions.map((a) => ({ l: i.S(`pa_${a}`) })),
      rows,
      roleName: i.L(ROLE_LABEL[role as RoleKey]),
      scopeRule: "",
      nUsers: i.S("nUsersRole", { n: (data.users ?? []).filter((u) => u.role === role).length }),
      canEdit,
      editing: ui.permEdit,
      notEditing: !ui.permEdit,
      edit: () => set({ permEdit: true, permDraft: JSON.parse(JSON.stringify(ov?.roles ?? {})) }),
      cancel: () => set({ permEdit: false, permDraft: null }),
      save: () => {
        if (!changes.length) {
          set({ permEdit: false, permDraft: null });
          return;
        }
        c.openModal("permSave", { diff, changes });
      },
      nDiff: i.S("nChanges", { n: diff.length }),
      hasDiff: !!diff.length,
      projects: projects.map((p) => ({ code: p.code, name: i.L(p.name) })),
      scopeRows,
      sEditing: ui.scopeEdit,
      sNotEditing: !ui.scopeEdit,
      sEdit: () => {
        const d: Record<string, string[]> = {};
        staff.forEach((u) => (d[u.id] = [...scopeOf(u)]));
        set({ scopeEdit: true, scopeDraft: d });
      },
      sCancel: () => set({ scopeEdit: false, scopeDraft: null }),
      sSave: () => {
        if (!scopeChanges.length) {
          set({ scopeEdit: false, scopeDraft: null });
          return;
        }
        c.openModal("scopeSave", { diff: sdiff, scopeChanges });
      },
      sDiff: i.S("nChanges", { n: sdiff.length }),
      hasSDiff: !!sdiff.length,
      grants: [],
    },
  };
}
