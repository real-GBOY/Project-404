import type { UnitOfWork } from "../../kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "../../kernel/errors.js";
import type { IAuditLogger, IEventBus, IUserProvider } from "../../contracts/index.js";
import { slugify, type Organization, type OrganizationMember } from "../domain/organization.js";
import type { OrganizationRepository } from "../infrastructure/organization-repository.js";
import { memberAdded, memberRemoved, organizationCreated } from "../events/events.js";

export interface OrganizationServiceDeps {
  repo: OrganizationRepository;
  users: IUserProvider;
  audit: IAuditLogger;
  events: IEventBus;
  uow: UnitOfWork;
}

/** Organizations & Users use cases (§7.4 start-here). */
export class OrganizationService {
  constructor(private readonly d: OrganizationServiceDeps) {}

  async createOrganization(input: {
    name: string;
    slug?: string;
    createdBy?: string;
    settings?: Record<string, unknown>;
  }): Promise<Organization> {
    const slug = (input.slug ? slugify(input.slug) : slugify(input.name)) || "org";

    return this.d.uow.transaction(async () => {
      if (await this.d.repo.findBySlug(slug)) {
        throw Conflict("organizations.slug_taken", `The slug "${slug}" is already in use.`);
      }
      const org = await this.d.repo.create({ name: input.name, slug, settings: input.settings ?? {} });

      if (input.createdBy) {
        if (!(await this.d.users.userExists(input.createdBy))) {
          throw ValidationError("organizations.unknown_user", "The creating user does not exist.");
        }
        await this.d.repo.addMember({
          organizationId: org.id,
          userId: input.createdBy,
          membershipRole: "owner",
        });
      }

      await this.d.audit.record({
        actorId: input.createdBy ?? null,
        actorType: input.createdBy ? "user" : "system",
        action: "organization.created",
        resourceType: "organization",
        resourceId: org.id,
        after: org,
      });
      await this.d.events.publish(
        organizationCreated({ organizationId: org.id, slug: org.slug, createdBy: input.createdBy ?? null }),
      );
      return org;
    });
  }

  async getOrganization(id: string): Promise<Organization> {
    const org = await this.d.repo.findById(id);
    if (!org) throw NotFound("organizations.not_found", "Organization not found.");
    return org;
  }

  async updateSettings(id: string, settings: Record<string, unknown>): Promise<Organization> {
    return this.d.uow.transaction(async () => {
      const org = await this.d.repo.findById(id);
      if (!org) throw NotFound("organizations.not_found", "Organization not found.");
      await this.d.repo.updateSettings(id, settings);
      await this.d.audit.record({
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
    return this.d.uow.transaction(async () => {
      const org = await this.d.repo.findById(input.organizationId);
      if (!org) throw NotFound("organizations.not_found", "Organization not found.");
      if (!(await this.d.users.userExists(input.userId))) {
        throw ValidationError("organizations.unknown_user", "That user does not exist.");
      }
      if (await this.d.repo.isMember(input.organizationId, input.userId)) {
        throw Conflict("organizations.already_member", "That user is already a member.");
      }
      const member = await this.d.repo.addMember({
        organizationId: input.organizationId,
        userId: input.userId,
        membershipRole: input.membershipRole ?? "member",
      });
      await this.d.audit.record({
        actorId: input.actorId ?? null,
        actorType: input.actorId ? "user" : "system",
        action: "organization.member_added",
        resourceType: "organization",
        resourceId: input.organizationId,
        after: { userId: input.userId, membershipRole: member.membershipRole },
      });
      await this.d.events.publish(
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
    await this.d.uow.transaction(async () => {
      if (!(await this.d.repo.isMember(organizationId, userId))) {
        throw NotFound("organizations.not_a_member", "That user is not a member.");
      }
      await this.d.repo.removeMember(organizationId, userId);
      await this.d.audit.record({
        actorId: actorId ?? null,
        actorType: actorId ? "user" : "system",
        action: "organization.member_removed",
        resourceType: "organization",
        resourceId: organizationId,
        after: { userId },
      });
      await this.d.events.publish(memberRemoved({ organizationId, userId }));
    });
  }

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    return this.d.repo.listMembers(organizationId);
  }
}
