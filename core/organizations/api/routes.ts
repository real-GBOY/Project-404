import { Router } from "express";
import { handler, parseBody } from "../../http/handler.js";
import type { RouteContext } from "../../http/route-context.js";
import { requireAuth } from "../../identity/api/auth-middleware.js";
import type { OrganizationService } from "../application/organization-service.js";
import { addMemberSchema, createOrganizationSchema, updateSettingsSchema } from "../validation/schemas.js";

export function organizationRoutes(service: OrganizationService, ctx: RouteContext): Router {
  const r = Router();
  r.use(ctx.authenticate);

  r.post(
    "/organizations",
    ctx.guard("create", "organization"),
    handler(async (req, res) => {
      const input = parseBody(createOrganizationSchema, req.body);
      const principal = requireAuth(req);
      const org = await service.createOrganization({ ...input, createdBy: principal.userId });
      res.status(201).json({ organization: org });
    }),
  );

  r.get(
    "/organizations/:id",
    ctx.guard("read", "organization"),
    handler(async (req, res) => {
      res.json({ organization: await service.getOrganization(req.params.id) });
    }),
  );

  r.patch(
    "/organizations/:id/settings",
    ctx.guard("update", "organization"),
    handler(async (req, res) => {
      const { settings } = parseBody(updateSettingsSchema, req.body);
      res.json({ organization: await service.updateSettings(req.params.id, settings) });
    }),
  );

  r.get(
    "/organizations/:id/members",
    ctx.guard("read", "organization"),
    handler(async (req, res) => {
      res.json({ members: await service.listMembers(req.params.id) });
    }),
  );

  r.post(
    "/organizations/:id/members",
    ctx.guard("manage_members", "organization"),
    handler(async (req, res) => {
      const input = parseBody(addMemberSchema, req.body);
      const principal = requireAuth(req);
      const member = await service.addMember({
        organizationId: req.params.id,
        userId: input.userId,
        membershipRole: input.membershipRole,
        actorId: principal.userId,
      });
      res.status(201).json({ member });
    }),
  );

  r.delete(
    "/organizations/:id/members/:userId",
    ctx.guard("manage_members", "organization"),
    handler(async (req, res) => {
      const principal = requireAuth(req);
      await service.removeMember(req.params.id, req.params.userId, principal.userId);
      res.status(204).end();
    }),
  );

  return r;
}
