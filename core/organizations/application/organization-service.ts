import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "../../kernel/db/db.js";
import { readInTenant } from "../../kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "../../kernel/errors.js";
import { runAsSystem } from "../../kernel/logging/context.js";
import { AUDIT_LOGGER, EVENT_BUS, UNIT_OF_WORK, USER_PROVIDER } from "../../kernel/tokens.js";
import type { IAuditLogger, IEventBus, IUserProvider } from "../../contracts/index.js";
import { slugify, type Organization, type OrganizationMember } from "../domain/organization.js";
import { OrganizationRepository } from "../infrastructure/organization-repository.js";
import { memberAdded, memberRemoved, organizationCreated } from "../events/events.js";

/** Organizations & Users use cases (§7.4 start-here). */
@Injectable()
export class OrganizationService {
  constructor(
    private readonly repo: OrganizationRepository,
    @Inject(USER_PROVIDER) private readonly users: IUserProvider,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async createOrganization(input: {
    name: string;
    slug?: string;
    createdBy?: string;
    settings?: Record<string, unknown>;
  }): Promise<Organization> {
    const slug = (input.slug ? slugify(input.slug) : slugify(input.name)) || "org";

    // Creating a tenant precedes any tenant context, so it runs on the system
    // connection (§ docs/tenancy.md): the new `organizations` row, the creator's
    // `owner` membership, and (via the `organization.created` subscriber) their
    // tenant-scoped `admin` role all land before RLS would have anything to
    // scope to.
    return runAsSystem(() =>
      this.uow.transaction(async () => {
        if (await this.repo.findBySlug(slug)) {
          throw Conflict("organizations.slug_taken", `The slug "${slug}" is already in use.`);
        }
        const org = await this.repo.create({ name: input.name, slug, settings: input.settings ?? {} });

        if (input.createdBy) {
          if (!(await this.users.userExists(input.createdBy))) {
            throw ValidationError("organizations.unknown_user", "The creating user does not exist.");
          }
          await this.repo.addMember({
            organizationId: org.id,
            userId: input.createdBy,
            membershipRole: "owner",
          });
        }

        await this.audit.record({
          actorId: input.createdBy ?? null,
          actorType: input.createdBy ? "user" : "system",
          action: "organization.created",
          resourceType: "organization",
          resourceId: org.id,
          after: org,
        });
        await this.events.publish(
          organizationCreated({
            organizationId: org.id,
            slug: org.slug,
            createdBy: input.createdBy ?? null,
          }),
        );
        return org;
      }),
    );
  }

  async getOrganization(id: string): Promise<Organization> {
    const org = await readInTenant(() => this.repo.findById(id));
    if (!org) throw NotFound("organizations.not_found", "Organization not found.");
    return org;
  }

  async updateSettings(id: string, settings: Record<string, unknown>): Promise<Organization> {
    return this.uow.transaction(async () => {
      const org = await this.repo.findById(id);
      if (!org) throw NotFound("organizations.not_found", "Organization not found.");
      await this.repo.updateSettings(id, settings);
      await this.audit.record({
        actorId: null,
        actorType: "system",
        action: "organization.settings_updated",
        resourceType: "organization",
        resourceId: id,
        before: org.settings,
        after: settings,
      });
      return { ...org, settings };
    });
  }

  async addMember(input: {
    organizationId: string;
    userId: string;
    membershipRole?: string;
    actorId?: string;
  }): Promise<OrganizationMember> {
    return this.uow.transaction(async () => {
      const org = await this.repo.findById(input.organizationId);
      if (!org) throw NotFound("organizations.not_found", "Organization not found.");
      if (!(await this.users.userExists(input.userId))) {
        throw ValidationError("organizations.unknown_user", "That user does not exist.");
      }
      if (await this.repo.isMember(input.organizationId, input.userId)) {
        throw Conflict("organizations.already_member", "That user is already a member.");
      }
      const member = await this.repo.addMember({
        organizationId: input.organizationId,
        userId: input.userId,
        membershipRole: input.membershipRole ?? "member",
      });
      await this.audit.record({
        actorId: input.actorId ?? null,
        actorType: input.actorId ? "user" : "system",
        action: "organization.member_added",
        resourceType: "organization",
        resourceId: input.organizationId,
        after: { userId: input.userId, membershipRole: member.membershipRole },
      });
      await this.events.publish(
        memberAdded({
          organizationId: input.organizationId,
          userId: input.userId,
          membershipRole: member.membershipRole,
        }),
      );
      return member;
    });
  }

  async removeMember(organizationId: string, userId: string, actorId?: string): Promise<void> {
    await this.uow.transaction(async () => {
      if (!(await this.repo.isMember(organizationId, userId))) {
        throw NotFound("organizations.not_a_member", "That user is not a member.");
      }
      await this.repo.removeMember(organizationId, userId);
      await this.audit.record({
        actorId: actorId ?? null,
        actorType: actorId ? "user" : "system",
        action: "organization.member_removed",
        resourceType: "organization",
        resourceId: organizationId,
        after: { userId },
      });
      await this.events.publish(memberRemoved({ organizationId, userId }));
    });
  }

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    return readInTenant(() => this.repo.listMembers(organizationId));
  }
}
