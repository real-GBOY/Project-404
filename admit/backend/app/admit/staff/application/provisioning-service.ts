import { Injectable } from "@nestjs/common";
import { getDb } from "@core/kernel/db/db.js";
import { Conflict, ValidationError } from "@core/kernel/errors.js";
import { runAsSystem } from "@core/kernel/logging/context.js";
import { IdentityService } from "@core/identity/application/identity-service.js";
import { OrganizationService } from "@core/organizations/application/organization-service.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { OWNER_ROLE_KEY } from "@admit/admit/shared/roles.js";

export interface ProvisionInput {
  /** The organizer's public name ("Nile Sessions Events"). */
  name: string;
  /** The address of their public site: /e/<slug>. Defaults to a slug made from the name. */
  slug?: string;
  ownerEmail: string;
  ownerName: string;
  /** The owner's first password (10+ characters). They can change it after signing in. */
  ownerPassword: string;
}

export interface Provisioned {
  organizationId: string;
  slug: string;
  ownerId: string;
  ownerEmail: string;
}

/**
 * Onboards a real organizer: the organization (the tenant), its first owner account, and the `owner` role. Nothing else is created: no demo
 * events, no demo people. Used by `npm run provision`; refuses an existing slug or e-mail before it creates anything, so a mistyped command
 * never leaves half an organizer behind.
 */
@Injectable()
export class ProvisioningService {
  constructor(
    private readonly identity: IdentityService,
    private readonly orgs: OrganizationService,
    private readonly rbac: RbacService,
  ) {}

  async provision(i: ProvisionInput): Promise<Provisioned> {
    const name = i.name.trim();
    const email = i.ownerEmail.trim().toLowerCase();
    if (name.length < 2) throw ValidationError("admit.provision_name", "Give the organizer a name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw ValidationError("admit.provision_email", "The owner needs a valid e-mail address.");
    if (i.ownerName.trim().length < 2) throw ValidationError("admit.provision_owner_name", "Give the owner's full name.");
    if (i.ownerPassword.length < 10) throw ValidationError("admit.provision_password", "The owner's password must be at least 10 characters.");

    const slug = (i.slug ?? name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug.length < 3) throw ValidationError("admit.provision_slug", "The site address needs at least 3 letters or digits.");

    // check both up front (system connection: neither exists in any tenant yet)
    const sys = getDb("system");
    if (await sys.selectFrom("organizations").select("id").where("slug", "=", slug).executeTakeFirst())
      throw Conflict("admit.provision_slug_taken", `The address "${slug}" is already used by another organizer.`);
    if (await sys.selectFrom("users").select("id").where("email_normalized", "=", email).executeTakeFirst())
      throw Conflict("admit.provision_email_taken", `${email} already has an account.`);

    const owner = await this.identity.register({ email, password: i.ownerPassword, displayName: i.ownerName.trim() });
    const org = await this.orgs.createOrganization({ name, slug, createdBy: owner.id });
    await runAsSystem(() => this.rbac.assignRole(owner.id, OWNER_ROLE_KEY, owner.id, org.id));
    return { organizationId: org.id, slug: org.slug, ownerId: owner.id, ownerEmail: email };
  }

  /** Lock-out recovery for an owner who forgot their password and has no other owner to reset it: run from the server with `--reset-owner`. */
  async resetOwnerPassword(email: string, newPassword: string): Promise<{ userId: string }> {
    if (newPassword.length < 10) throw ValidationError("admit.provision_password", "The password must be at least 10 characters.");
    const row = await getDb("system").selectFrom("users").select("id").where("email_normalized", "=", email.trim().toLowerCase()).executeTakeFirst();
    if (!row) throw ValidationError("admit.no_account", "No account uses that e-mail.");
    await this.identity.setPassword(row.id, newPassword, row.id);
    return { userId: row.id };
  }
}
