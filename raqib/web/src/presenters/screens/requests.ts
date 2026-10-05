import type { AccountRequest } from "@/api/types";
import { ApiError } from "@/services/http";
import { badge } from "../common";
import type { Ctx } from "../context";

const TONE = { pending: "warn", approved: "ok", rejected: "bad" } as const;
const fail = (c: Ctx) => (e: unknown) => c.toast(e instanceof ApiError ? e.message : c.i.S("actionFailed"));

/** The rows of the account-requests tab on the users screen. */
export function requestRows(c: Ctx) {
  const { i } = c;
  return (c.data.accountRequests ?? []).map((r) => ({
    ref: r.ref, name: r.name, role: i.S(`req_role_${r.requestedRole}`), proj: r.requestedProjects || "—", go: () => c.go("request", r.id),
    st: badge(i.S(`rqs_${r.status}`), TONE[r.status]), at: i.fd(r.createdAt, "d"),
  }));
}

/** Open the approval dialog (role + projects). */
export function openApprove(c: Ctx, r: AccountRequest): void {
  c.openModal("reqApprove", { rid: r.id, ref: r.ref }, { role: r.requestedRole, projects: [] });
}

/** One request, for review (design: vmRequest). */
export function requestDetail(c: Ctx, r: AccountRequest) {
  const { i, me } = c;
  const canDecide = r.status === "pending" && me.permissions.users.includes("A");
  const projectNames = new Map((c.data.projects ?? []).map((p) => [p.id, i.L(p.name)]));
  return {
    rq2: {
      back: () => { c.set({ utab: "requests" }); c.go("users"); },
      ref: r.ref, st: badge(i.S(`rqs_${r.status}`), TONE[r.status]), name: r.name,
      details: [
        [i.S("f_email"), r.email], [i.S("f_phone"), r.phone], [i.S("f_nid"), r.nationalId], [i.S("f_emp"), r.employeeNo || "—"], [i.S("f_dept"), r.department || "—"],
        [i.S("f_role"), i.S(`req_role_${r.requestedRole}`)], [i.S("f_project"), r.requestedProjects || "—"], [i.S("f_date"), i.fd(r.createdAt, "dt")],
      ].map(([k, v]) => ({ k, v })),
      just: r.justification,
      declVer: `v${r.declaration.version}`,
      decl: [1, 2, 3, 4, 5].map((n) => ({ t: i.S(`decl_${n}`) })),
      signed: r.declaration.signedName, signedAt: i.fd(r.declaration.signedAt, "dt"), ip: "—", hash: "—",
      canDecide, approve: () => openApprove(c, r), reject: () => c.openModal("reqReject", { rid: r.id, ref: r.ref }),
      isApproved: r.status === "approved", assigned: r.assignedRole ? `${i.S(`req_role_${r.assignedRole}`)} · ${r.assignedProjectIds.map((p) => projectNames.get(p) ?? p).join("، ")}` : "",
      setupDone: false, setupPending: r.status === "approved", setupTxt: i.S("req_setupSent"), openSetup: () => undefined,
      resend: () => void c.actions.resendRequest(r.id).then(() => c.toast(i.S("toastLinkResent"))).catch(fail(c)),
      isRejected: r.status === "rejected", reason: r.decisionReason ?? "",
      hist: [
        { label: i.S("rqh_submitted"), actor: r.name, at: i.fd(r.createdAt, "dt") },
        ...(r.decidedAt && r.decidedBy ? [{ label: i.S(r.status === "approved" ? "rqh_approved" : "rqh_rejected"), actor: i.L(r.decidedBy), at: i.fd(r.decidedAt, "dt") }] : []),
      ],
    },
  };
}
