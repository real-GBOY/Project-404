import type { ModalHandlers } from "./types";

/** Account requests and the confidential area's grants. */
export const accessHandlers: ModalHandlers = {
  async reqApprove({ c, m, f }) {
    await c.actions.approveRequest(m.rid as string, {
      role: f.role as string,
      projectIds: (f.projects as string[] | undefined) ?? [],
    });
    c.toast(c.i.S("toastReqApproved", { r: String(m.ref ?? "") }));
  },
  async reqReject({ c, m, reason }) {
    await c.actions.rejectRequest(m.rid as string, reason);
    c.toast(c.i.S("toastReqRejected", { r: String(m.ref ?? "") }));
  },
  async reveal({ c, m, reason }) {
    await c.actions.confReveal(m.rid as string, reason);
  },
  async revoke({ c, m, reason }) {
    await c.actions.confRevoke(m.gid as string, reason);
    c.toast(c.i.S("toastGrantRevoked"));
  },
  async grantAdd({ c, f, reason }) {
    await c.actions.confIssueGrant({
      userId: f.guser as string,
      level: (f.level as never) || "view",
      scope: (f.gscope as never) || "standard",
      reason,
      expiresAt: `${String(f.expires)}T23:59:00Z`,
    });
    c.toast(c.i.S("toastGrantIssued"));
  },
};
