import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { parseBody } from "../../http/handler.js";
import { Forbidden } from "../../kernel/errors.js";
import type { RouteContext } from "../../http/route-context.js";
import { requireAuth, type Principal } from "../../identity/api/auth-middleware.js";
import type { OrganizationService } from "../application/organization-service.js";
import { addMemberSchema, createOrganizationSchema, updateSettingsSchema } from "../validation/schemas.js";

export function organizationRoutes(service: OrganizationService, ctx: RouteContext): FastifyPluginAsync {
  return async (app) => {
    app.addHook("preHandler", ctx.authenticate);

    // Self-service (§ docs/tenancy.md): any authenticated user may create an
    // organization and becomes its owner + tenant-scoped admin. No RBAC guard —
    // a first-time user holds no permissions in any tenant yet.
    app.post("/organizations", async (req, reply) => {
      const input = parseBody(createOrganizationSchema, req.body);
      const org = await service.createOrganization({ ...input, createdBy: requireAuth(req).userId });
      reply.status(201).send({ organization: org });
    });

    // Everything below operates on the caller's *active* tenant; the `:id` must
    // match it. RLS is the backstop, this is the clean error.
    const assertActive = (req: FastifyRequest, id: string): Principal => {
      const principal = requireAuth(req);
      if (id !== principal.organizationId) {
        throw Forbidden("organizations.not_active", "That organization is not your active tenant.");
      }
      return principal;
    };

    app.get<{ Params: { id: string } }>(
      "/organizations/:id",
      { preHandler: ctx.guard("read", "organization") },
      async (req) => {
        assertActive(req, req.params.id);
        return { organization: await service.getOrganization(req.params.id) };
      },
    );

    app.patch<{ Params: { id: string } }>(
      "/organizations/:id/settings",
      { preHandler: ctx.guard("update", "organization") },
      async (req) => {
        assertActive(req, req.params.id);
        const { settings } = parseBody(updateSettingsSchema, req.body);
        return { organization: await service.updateSettings(req.params.id, settings) };
      },
    );

    app.get<{ Params: { id: string } }>(
      "/organizations/:id/members",
      { preHandler: ctx.guard("read", "organization") },
      async (req) => {
        assertActive(req, req.params.id);
        return { members: await service.listMembers(req.params.id) };
      },
    );

    app.post<{ Params: { id: string } }>(
      "/organizations/:id/members",
      { preHandler: ctx.guard("manage_members", "organization") },
      async (req, reply) => {
        const principal = assertActive(req, req.params.id);
        const input = parseBody(addMemberSchema, req.body);
        const member = await service.addMember({
          organizationId: req.params.id,
          userId: input.userId,
          ...(input.membershipRole ? { membershipRole: input.membershipRole } : {}),
          actorId: principal.userId,
        });
        reply.status(201).send({ member });
      },
    );

    app.delete<{ Params: { id: string; userId: string } }>(
      "/organizations/:id/members/:userId",
      { preHandler: ctx.guard("manage_members", "organization") },
      async (req, reply) => {
        const principal = assertActive(req, req.params.id);
        await service.removeMember(req.params.id, req.params.userId, principal.userId);
        reply.status(204).send();
      },
    );
  };
}
