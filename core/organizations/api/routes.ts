import type { FastifyPluginAsync } from "fastify";
import { parseBody } from "../../http/handler.js";
import type { RouteContext } from "../../http/route-context.js";
import { requireAuth } from "../../identity/api/auth-middleware.js";
import type { OrganizationService } from "../application/organization-service.js";
import { addMemberSchema, createOrganizationSchema, updateSettingsSchema } from "../validation/schemas.js";

export function organizationRoutes(service: OrganizationService, ctx: RouteContext): FastifyPluginAsync {
  return async (app) => {
    app.addHook("preHandler", ctx.authenticate);

    app.post(
      "/organizations",
      { preHandler: ctx.guard("create", "organization") },
      async (req, reply) => {
        const input = parseBody(createOrganizationSchema, req.body);
        const org = await service.createOrganization({ ...input, createdBy: requireAuth(req).userId });
        reply.status(201).send({ organization: org });
      },
    );

    app.get<{ Params: { id: string } }>(
      "/organizations/:id",
      { preHandler: ctx.guard("read", "organization") },
      async (req) => ({ organization: await service.getOrganization(req.params.id) }),
    );

    app.patch<{ Params: { id: string } }>(
      "/organizations/:id/settings",
      { preHandler: ctx.guard("update", "organization") },
      async (req) => {
        const { settings } = parseBody(updateSettingsSchema, req.body);
        return { organization: await service.updateSettings(req.params.id, settings) };
      },
    );

    app.get<{ Params: { id: string } }>(
      "/organizations/:id/members",
      { preHandler: ctx.guard("read", "organization") },
      async (req) => ({ members: await service.listMembers(req.params.id) }),
    );

    app.post<{ Params: { id: string } }>(
      "/organizations/:id/members",
      { preHandler: ctx.guard("manage_members", "organization") },
      async (req, reply) => {
        const input = parseBody(addMemberSchema, req.body);
        const member = await service.addMember({
          organizationId: req.params.id,
          userId: input.userId,
          ...(input.membershipRole ? { membershipRole: input.membershipRole } : {}),
          actorId: requireAuth(req).userId,
        });
        reply.status(201).send({ member });
      },
    );

    app.delete<{ Params: { id: string; userId: string } }>(
      "/organizations/:id/members/:userId",
      { preHandler: ctx.guard("manage_members", "organization") },
      async (req, reply) => {
        await service.removeMember(req.params.id, req.params.userId, requireAuth(req).userId);
        reply.status(204).send();
      },
    );
  };
}
