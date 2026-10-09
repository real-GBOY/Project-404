import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { currentExecutor, unitOfWork, type UnitOfWork } from "@core/kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "@core/kernel/errors.js";
import { newId } from "@core/kernel/id.js";
import { runAsSystem, withContext } from "@core/kernel/logging/context.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { argon2Hasher } from "@core/identity/infrastructure/password-hasher.js";
import { IdentityService } from "@core/identity/application/identity-service.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { requireCan, type Access } from "@raqib/raqib/access/access.js";
import { PeopleRepository } from "@raqib/raqib/people/infrastructure/people-repository.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { Counters } from "@raqib/raqib/shared/counters.js";
import { ALL_PROJECT_ROLES } from "@raqib/raqib/shared/modules.js";
import { coreRoleKey } from "@raqib/raqib/shared/roles.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { OnboardingRepository, type AccountRequestRecord, type RequestedRole } from "../infrastructure/onboarding-repository.js";
import type { Page } from "@raqib/raqib/shared/paging.js";

export const DECLARATION_VERSION = "2026-1";
export const REQUESTABLE_ROLES: RequestedRole[] = ["qe", "pm", "ins", "gs", "guard", "adm"];
/** Owner-level roles are provisioned, never approved from a public request. */
const APPROVABLE: ReadonlySet<string> = new Set(REQUESTABLE_ROLES);

const ROLE_TITLES: Record<RequestedRole, L10n> = {
  qe: { ar: "أخصائي جودة", en: "Quality Specialist" },
  pm: { ar: "مدير مشروع", en: "Project Manager" },
  ins: { ar: "مفتش جودة", en: "Quality Inspector" },
  gs: { ar: "مشرف أمن", en: "Security Supervisor" },
  guard: { ar: "حارس أمن", en: "Security Guard" },
  adm: { ar: "موظف إداري", en: "Administrative Staff" },
};

export interface PublicInfo {
  organization: { name: string };
  projects: Array<{ id: string; name: L10n }>;
  roles: RequestedRole[];
  declarationVersion: string;
}

export interface PublicRequestInput {
  name: string;
  email: string;
  phone: string;
  nationalId: string;
  employeeNo: string;
  department: string;
  role: RequestedRole;
  projects: string;
  justification: string;
  signature: string;
  agree: boolean;
}

export interface AccountRequestView {
  id: string;
  ref: string;
  name: string;
  email: string;
  phone: string;
  nationalId: string;
  employeeNo: string;
  department: string;
  requestedRole: RequestedRole;
  requestedProjects: string;
  justification: string;
  declaration: { version: string; signedName: string; signedAt: string };
  status: AccountRequestRecord["status"];
  decidedBy: L10n | null;
  decidedAt: string | null;
  decisionReason: string | null;
  assignedRole: string | null;
  assignedProjectIds: string[];
  createdAt: string;
}

const maskNid = (n: string): string => (n.length > 4 ? `${"•".repeat(n.length - 4)}${n.slice(-4)}` : n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const view = (r: AccountRequestRecord, full: boolean): AccountRequestView => ({
  id: r.id,
  ref: r.ref,
  name: r.name,
  email: r.email,
  phone: r.phone,
  nationalId: full ? r.nationalId : maskNid(r.nationalId),
  employeeNo: r.employeeNo,
  department: r.department,
  requestedRole: r.requestedRole,
  requestedProjects: r.requestedProjects,
  justification: r.justification,
  declaration: { version: r.declarationVersion, signedName: r.signedName, signedAt: r.signedAt.toISOString() },
  status: r.status,
  decidedBy: r.decidedBy,
  decidedAt: r.decidedAt?.toISOString() ?? null,
  decisionReason: r.decisionReason,
  assignedRole: r.assignedRole,
  assignedProjectIds: r.assignedProjectIds,
  createdAt: r.createdAt.toISOString(),
});

/**
 * Account onboarding. The public form is the only unauthenticated door in Raqib: it can only create a pending
 * request (rate limited, validated, with a typed signature on the declaration). Approving is a reviewer's decision
 * that creates the account with a random unknown password and sends the secure password-setup link to the
 * applicant's email — nobody, including the reviewer, ever chooses or sees a password.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly repo: OnboardingRepository,
    private readonly projects: ProjectsRepository,
    private readonly people: PeopleRepository,
    private readonly counters: Counters,
    private readonly rbac: RbacService,
    private readonly identity: IdentityService,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  // ── public ───────────────────────────────────────────────────────────

  private async orgBySlug(slug: string): Promise<{ id: string; name: string }> {
    const o = await runAsSystem(() => currentExecutor().selectFrom("organizations").select(["id", "name"]).where("slug", "=", slug).executeTakeFirst());
    if (!o) throw NotFound("raqib.org_not_found", "This organization does not accept account requests.");
    return o;
  }

  async publicInfo(slug: string): Promise<PublicInfo> {
    const o = await this.orgBySlug(slug);
    return withContext({ organizationId: o.id }, async () => {
      const projects = await this.uow.transaction(() => this.projects.list());
      return {
        organization: { name: o.name },
        projects: projects.filter((p) => p.status !== ("archived" as string)).map((p) => ({ id: p.id, name: p.name })),
        roles: REQUESTABLE_ROLES,
        declarationVersion: DECLARATION_VERSION,
      };
    });
  }

  async submitPublic(slug: string, input: PublicRequestInput): Promise<{ ref: string }> {
    const name = input.name.trim();
    const email = input.email.trim();
    if (
      name.length < 3 ||
      !EMAIL.test(email) ||
      !/^[0-9+\s-]{7,20}$/.test(input.phone.trim()) ||
      !/^[0-9]{10}$/.test(input.nationalId.trim()) ||
      input.justification.trim().length < 10
    ) {
      throw ValidationError("raqib.invalid_request", "Check the highlighted fields.");
    }
    if (!REQUESTABLE_ROLES.includes(input.role)) throw ValidationError("raqib.invalid_role", "Choose a role.");
    if (!input.agree || input.signature.trim().toLowerCase() !== name.toLowerCase())
      throw ValidationError("raqib.declaration_required", "Agree to the declaration and sign with your full name.");
    const o = await this.orgBySlug(slug);
    return withContext({ organizationId: o.id }, () =>
      this.uow.transaction(async () => {
        const now = this.clock.now();
        const ref = await this.counters.next("ACR", now.getUTCFullYear());
        try {
          await this.repo.insert({
            ref,
            name,
            email,
            phone: input.phone.trim(),
            nationalId: input.nationalId.trim(),
            employeeNo: input.employeeNo.trim(),
            department: input.department.trim(),
            requestedRole: input.role,
            requestedProjects: input.projects.trim(),
            justification: input.justification.trim(),
            declarationVersion: DECLARATION_VERSION,
            signedName: input.signature.trim(),
            signedAt: now,
          });
        } catch (e) {
          if ((e as { code?: string }).code === "23505") throw Conflict("raqib.request_pending", "A request for this email is already waiting for review.");
          throw e;
        }
        await this.audit.record({
          actorId: null,
          actorType: "system",
          action: "raqib.account_request.submitted",
          resourceType: "raqib_account_request",
          resourceId: ref,
          metadata: { role: input.role },
        });
        return { ref };
      }),
    );
  }

  // ── reviewers ────────────────────────────────────────────────────────

  async list(who: Access, page?: Page): Promise<AccountRequestView[]> {
    requireCan(who, "users", "V");
    return this.uow.transaction(async () => (await this.repo.list(page)).map((r) => view(r, false)));
  }

  async get(id: string, who: Access): Promise<AccountRequestView> {
    requireCan(who, "users", "V");
    return this.uow.transaction(async () => {
      const r = await this.repo.find(id);
      if (!r) throw NotFound("raqib.request_not_found", "Request not found.");
      return view(r, true);
    });
  }

  async approve(id: string, input: { role: RequestedRole; projectIds: string[]; comment?: string }, who: Access): Promise<AccountRequestView> {
    requireCan(who, "users", "A");
    if (!APPROVABLE.has(input.role)) throw ValidationError("raqib.invalid_role", "This role cannot be assigned from a request.");
    if (!ALL_PROJECT_ROLES.includes(input.role as never) && input.projectIds.length === 0)
      throw ValidationError("raqib.projects_required", "Assign at least one project.");
    const req = await this.uow.transaction(async () => {
      const r = await this.repo.find(id);
      if (!r) throw NotFound("raqib.request_not_found", "Request not found.");
      if (r.status !== "pending") throw Conflict("raqib.request_decided", "This request has already been decided.");
      const known = new Set((await this.projects.list()).map((p) => p.id));
      if (input.projectIds.some((p) => !known.has(p))) throw ValidationError("raqib.project_not_found", "A chosen project does not exist.");
      return r;
    });
    const orgId = who.organizationId;
    // 1) the account: random unknown password (only the emailed link can set one), verified because the link proves the mailbox
    const userId = newId("usr");
    const password = await argon2Hasher.hash(randomBytes(32).toString("base64url"));
    await runAsSystem(() =>
      unitOfWork.transaction(async () => {
        const ex = currentExecutor();
        if (await ex.selectFrom("users").select("id").where("email_normalized", "=", req.email.toLowerCase()).executeTakeFirst()) {
          throw Conflict("raqib.email_taken", "An account with this email already exists.");
        }
        await ex
          .insertInto("users")
          .values({
            id: userId,
            email: req.email,
            email_normalized: req.email.toLowerCase(),
            password_hash: password,
            display_name: req.name,
            status: "active",
            email_verified_at: this.clock.now(),
            locale: "ar",
          })
          .execute();
        await ex
          .insertInto("organization_members")
          .values({ id: newId("mem"), organization_id: orgId, user_id: userId, membership_role: "member" })
          .execute();
      }),
    );
    try {
      await runAsSystem(() => this.rbac.assignRole(userId, coreRoleKey(input.role), who.userId, orgId));
      // 2) the Raqib profile, project scope, the decision and its audit entry — one tenant transaction
      await this.uow.transaction(async () => {
        const t = ROLE_TITLES[input.role];
        await this.people.insert({
          userId,
          roleKey: input.role,
          nameAr: req.name,
          nameEn: req.name,
          titleAr: t.ar,
          titleEn: t.en,
          employeeNo: req.employeeNo || null,
          phone: req.phone,
          status: "active",
        });
        for (const p of input.projectIds) await this.people.assign(userId, p, who.today, who.userId, `Account request ${req.ref}`);
        await this.repo.decide(req.id, {
          status: "approved",
          by: { id: who.userId, name: { ar: who.nameAr, en: who.nameEn } },
          reason: input.comment?.trim() || null,
          role: input.role,
          projectIds: input.projectIds,
          userId,
        });
        await this.audit.record({
          actorId: who.userId,
          action: "raqib.account_request.approved",
          resourceType: "raqib_account_request",
          resourceId: req.ref,
          after: { role: input.role, projectIds: input.projectIds, userId },
          metadata: { reason: input.comment?.trim() || null },
        });
      });
    } catch (e) {
      // the account never became usable: take it back out so the request can be approved again
      await runAsSystem(() =>
        unitOfWork.transaction(async () => {
          const ex = currentExecutor();
          await ex.deleteFrom("organization_members").where("user_id", "=", userId).execute();
          await ex.deleteFrom("users").where("id", "=", userId).execute();
        }),
      ).catch(() => undefined);
      throw e;
    }
    await this.identity.requestPasswordReset(req.email);
    return this.get(id, who);
  }

  async reject(id: string, reason: string, who: Access): Promise<AccountRequestView> {
    requireCan(who, "users", "A");
    if (reason.trim().length < 3) throw ValidationError("raqib.reason_required", "A reason is required to reject a request.");
    await this.uow.transaction(async () => {
      const r = await this.repo.find(id, true);
      if (!r) throw NotFound("raqib.request_not_found", "Request not found.");
      if (r.status !== "pending") throw Conflict("raqib.request_decided", "This request has already been decided.");
      await this.repo.decide(id, { status: "rejected", by: { id: who.userId, name: { ar: who.nameAr, en: who.nameEn } }, reason: reason.trim() });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.account_request.rejected",
        resourceType: "raqib_account_request",
        resourceId: r.ref,
        metadata: { reason: reason.trim() },
      });
    });
    return this.get(id, who);
  }

  /** Send a fresh password-setup link to an approved applicant who has not set a password yet. */
  async resend(id: string, who: Access): Promise<void> {
    requireCan(who, "users", "A");
    const r = await this.uow.transaction(() => this.repo.find(id));
    if (!r) throw NotFound("raqib.request_not_found", "Request not found.");
    if (r.status !== "approved") throw Conflict("raqib.request_not_approved", "Only an approved request has a setup link.");
    await this.identity.requestPasswordReset(r.email);
    await this.uow.transaction(() =>
      this.audit.record({ actorId: who.userId, action: "raqib.account_request.link_resent", resourceType: "raqib_account_request", resourceId: r.ref }),
    );
  }
}
