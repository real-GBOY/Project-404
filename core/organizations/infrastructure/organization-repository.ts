import { currentExecutor } from "../../kernel/db/db.js";
import { newId } from "../../kernel/id.js";
import type { Organization, OrganizationMember } from "../domain/organization.js";

export class OrganizationRepository {
  async create(input: {
    name: string;
    slug: string;
    settings?: Record<string, unknown>;
  }): Promise<Organization> {
    const id = newId("org");
    await currentExecutor()
      .insertInto("organizations")
      .values({ id, name: input.name, slug: input.slug, settings: input.settings ?? {} })
      .execute();
    return { id, name: input.name, slug: input.slug, settings: input.settings ?? {} };
  }

  async findById(id: string): Promise<Organization | null> {
    const row = await currentExecutor()
      .selectFrom("organizations")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toOrg(row) : null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const row = await currentExecutor()
      .selectFrom("organizations")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst();
    return row ? this.toOrg(row) : null;
  }

  async updateSettings(id: string, settings: Record<string, unknown>): Promise<void> {
    await currentExecutor()
      .updateTable("organizations")
      .set({ settings })
      .where("id", "=", id)
      .execute();
  }

  async rename(id: string, name: string): Promise<void> {
    await currentExecutor().updateTable("organizations").set({ name }).where("id", "=", id).execute();
  }

  async addMember(input: {
    organizationId: string;
    userId: string;
    membershipRole: string;
  }): Promise<OrganizationMember> {
    const id = newId("mem");
    await currentExecutor()
      .insertInto("organization_members")
      .values({
        id,
        organization_id: input.organizationId,
        user_id: input.userId,
        membership_role: input.membershipRole,
      })
      .execute();
    return {
      id,
      organizationId: input.organizationId,
      userId: input.userId,
      membershipRole: input.membershipRole,
      joinedAt: new Date(),
    };
  }

  async removeMember(organizationId: string, userId: string): Promise<void> {
    await currentExecutor()
      .deleteFrom("organization_members")
      .where("organization_id", "=", organizationId)
      .where("user_id", "=", userId)
      .execute();
  }

  async isMember(organizationId: string, userId: string): Promise<boolean> {
    const row = await currentExecutor()
      .selectFrom("organization_members")
      .select("id")
      .where("organization_id", "=", organizationId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return row !== undefined;
  }

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const rows = await currentExecutor()
      .selectFrom("organization_members")
      .selectAll()
      .where("organization_id", "=", organizationId)
      .orderBy("joined_at", "asc")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      userId: r.user_id,
      membershipRole: r.membership_role,
      joinedAt: new Date(r.joined_at),
    }));
  }

  async memberCount(organizationId: string): Promise<number> {
    const row = await currentExecutor()
      .selectFrom("organization_members")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("organization_id", "=", organizationId)
      .executeTakeFirst();
    return Number(row?.count ?? 0);
  }

  private toOrg(row: {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, unknown>;
  }): Organization {
    return { id: row.id, name: row.name, slug: row.slug, settings: row.settings ?? {} };
  }
}
