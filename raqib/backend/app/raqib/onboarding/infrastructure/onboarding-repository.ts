import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { getContext } from "@core/kernel/logging/context.js";
import { open, seal } from "@raqib/raqib/shared/data-key.js";
import { raqibDb } from "@raqib/raqib/db/executor.js";
import { raqibId } from "@raqib/raqib/shared/ids.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";
import { fetchSize, type Page } from "@raqib/raqib/shared/paging.js";

export type RequestStatus = "pending" | "approved" | "rejected";
export type RequestedRole = "qe" | "pm" | "ins" | "gs" | "guard" | "adm";

export interface AccountRequestRecord {
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
  declarationVersion: string;
  signedName: string;
  signedAt: Date;
  status: RequestStatus;
  decidedBy: L10n | null;
  decidedAt: Date | null;
  decisionReason: string | null;
  assignedRole: string | null;
  assignedProjectIds: string[];
  userId: string | null;
  createdAt: Date;
}

export interface NewAccountRequest {
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
  declarationVersion: string;
  signedName: string;
  signedAt: Date;
}

const org = (): string => {
  const id = getContext()?.organizationId;
  if (!id) throw new Error("onboarding repository used outside a tenant context");
  return id;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRecord = (r: any): AccountRequestRecord => ({
  id: r.id,
  ref: r.ref,
  name: r.name,
  email: r.email,
  phone: r.phone,
  nationalId: open(r.national_id),
  employeeNo: r.employee_no,
  department: r.department,
  requestedRole: r.requested_role,
  requestedProjects: r.requested_projects,
  justification: r.justification,
  declarationVersion: r.declaration_version,
  signedName: r.signed_name,
  signedAt: r.signed_at,
  status: r.status,
  decidedBy: r.decided_by_name_en ? { ar: r.decided_by_name_ar, en: r.decided_by_name_en } : null,
  decidedAt: r.decided_at,
  decisionReason: r.decision_reason,
  assignedRole: r.assigned_role,
  assignedProjectIds: (r.assigned_project_ids as string[] | null) ?? [],
  userId: r.user_id,
  createdAt: r.created_at,
});

@Injectable()
export class OnboardingRepository {
  async insert(r: NewAccountRequest): Promise<string> {
    const id = raqibId("acr");
    await raqibDb()
      .insertInto("raqib_account_requests")
      .values({
        id,
        organization_id: org(),
        ref: r.ref,
        name: r.name,
        email: r.email,
        phone: r.phone,
        national_id: seal(r.nationalId),
        employee_no: r.employeeNo,
        department: r.department,
        requested_role: r.requestedRole,
        requested_projects: r.requestedProjects,
        justification: r.justification,
        declaration_version: r.declarationVersion,
        signed_name: r.signedName,
        signed_at: r.signedAt,
      })
      .execute();
    return id;
  }

  async list(page?: Page): Promise<AccountRequestRecord[]> {
    let q = raqibDb().selectFrom("raqib_account_requests").selectAll().orderBy("created_at", "desc").orderBy("id", "desc");
    if (page) q = q.limit(fetchSize(page)).offset(page.offset);
    return (await q.execute()).map(toRecord);
  }

  async find(id: string, lock = false): Promise<AccountRequestRecord | null> {
    let q = raqibDb().selectFrom("raqib_account_requests").selectAll().where("id", "=", id);
    if (lock) q = q.forUpdate();
    const r = await q.executeTakeFirst();
    return r ? toRecord(r) : null;
  }

  async decide(
    id: string,
    d: { status: "approved" | "rejected"; by: { id: string; name: L10n }; reason: string | null; role?: string; projectIds?: string[]; userId?: string },
  ): Promise<void> {
    await raqibDb()
      .updateTable("raqib_account_requests")
      .set({
        status: d.status,
        decided_by: d.by.id,
        decided_by_name_ar: d.by.name.ar,
        decided_by_name_en: d.by.name.en,
        decided_at: sql`now()` as never,
        decision_reason: d.reason,
        assigned_role: d.role ?? null,
        assigned_project_ids: d.projectIds ? (JSON.stringify(d.projectIds) as never) : null,
        user_id: d.userId ?? null,
      })
      .where("id", "=", id)
      .execute();
  }
}
