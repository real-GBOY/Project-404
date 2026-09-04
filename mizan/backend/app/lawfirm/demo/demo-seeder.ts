import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { currentExecutor, unitOfWork, type UnitOfWork } from "@core/kernel/db/db.js";
import { newId } from "@core/kernel/id.js";
import { runAsSystem, withContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { argon2Hasher } from "@core/identity/infrastructure/password-hasher.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { lawfirmId } from "@app/lawfirm/shared/ids.js";
import {
  DEMO_ACTIVITY,
  DEMO_CLIENTS,
  DEMO_CONTACTS,
  DEMO_DOCUMENTS,
  DEMO_EVENTS,
  DEMO_EXPENSES,
  DEMO_HEARINGS,
  DEMO_INVOICES,
  DEMO_MATTERS,
  DEMO_NOTES,
  DEMO_NOTIFICATIONS,
  DEMO_PARTICIPANTS,
  DEMO_PAYMENTS,
  DEMO_TASKS,
  DEMO_TEAM,
  DEMO_UPDATES,
} from "./demo-data.js";

const log = moduleLogger("lawfirm-demo-seed");
const DEMO_PASSWORD = "demo-password-2026";
const DEMO_SLUG = "tawfik-partners";

/**
 * Opt-in demo dataset (README §12 — "demo data is a separate opt-in seeder").
 * Runs from `AppSeedService` only when `MIZAN_SEED_DEMO === "true"`. Idempotent:
 * skips entirely if the Mizan org already exists. Ports
 * `mizan/web/src/mocks/fixtures/db.ts` so the web client can run against the
 * real backend with the data it shows today.
 */
@Injectable()
export class DemoSeeder {
  constructor(
    private readonly rbac: RbacService,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async seed(clock: { now(): Date }): Promise<void> {
    const already = await runAsSystem(() =>
      unitOfWork.transaction(() =>
        currentExecutor()
          .selectFrom("organizations")
          .select("id")
          .where("slug", "=", DEMO_SLUG)
          .executeTakeFirst(),
      ),
    );
    if (already) {
      // The dataset is seeded once, but the demo admin's identity in
      // `demo-data.ts` is authoritative — reconcile it so a rename in code
      // reaches an already-seeded deployment on the next boot.
      const admin = DEMO_TEAM.find((t) => t.key === "usr_dev")!;
      await runAsSystem(() =>
        unitOfWork.transaction(async () => {
          const ex = currentExecutor();
          const owner = await ex
            .selectFrom("organization_members")
            .select("user_id")
            .where("organization_id", "=", already.id)
            .where("membership_role", "=", "owner")
            .executeTakeFirst();
          if (owner) {
            await ex
              .updateTable("users")
              .set({
                display_name: admin.name,
                email: admin.email,
                email_normalized: admin.email,
              })
              .where("id", "=", owner.user_id)
              .execute();
          }
        }),
      );
      log.info("demo data already present — reconciled the admin identity, skipping the rest");
      return;
    }

    const now = clock.now();
    const day = 86_400_000;
    const at = (days: number, hour = 10): Date => {
      const d = new Date(now.getTime() + days * day);
      d.setHours(hour, 0, 0, 0);
      return d;
    };

    // ── users + org + roles (system context) ────────────────────────────────
    const userId = new Map<string, string>();
    const passwordHash = await argon2Hasher.hash(DEMO_PASSWORD);
    const orgId = newId("org");

    await runAsSystem(() =>
      unitOfWork.transaction(async () => {
        const ex = currentExecutor();
        for (const t of DEMO_TEAM) {
          const id = newId("usr");
          userId.set(t.key, id);
          await ex
            .insertInto("users")
            .values({
              id,
              email: t.email,
              email_normalized: t.email,
              password_hash: passwordHash,
              display_name: t.name,
              status: "active",
              email_verified_at: now,
              locale: "en",
            })
            .execute();
        }
        for (const [slug, name] of [
          [DEMO_SLUG, "Mizan"],
          ["demo-firm", "Demo Firm"],
        ] as const) {
          await ex
            .insertInto("organizations")
            .values({ id: slug === DEMO_SLUG ? orgId : newId("org"), name, slug, settings: {} })
            .execute();
        }
        for (const t of DEMO_TEAM) {
          await ex
            .insertInto("organization_members")
            .values({
              id: newId("mem"),
              organization_id: orgId,
              user_id: userId.get(t.key)!,
              membership_role: t.key === "usr_dev" ? "owner" : "member",
            })
            .execute();
        }
      }),
    );

    const admin = userId.get("usr_dev")!;
    for (const t of DEMO_TEAM) {
      await runAsSystem(() => this.rbac.assignRole(userId.get(t.key)!, t.role, admin, orgId));
    }

    // ── law-firm data (tenant context) ─────────────────────────────────────
    await withContext({ userId: userId.get("usr_dev")!, organizationId: orgId }, () =>
      this.uow.transaction(async () => {
        const ex = currentExecutor();

        await ex
          .insertInto("lawfirm_settings")
          .values({
            organization_id: orgId,
            firm_name: "Mizan",
            registration_number: "EG-LAW-2009-0447",
            address: "Nile City Towers, North Tower, 21st Floor, Corniche El Nil, Cairo",
            default_currency: "EGP",
            vat_rate: "0.14",
            matter_types: [
              "Litigation",
              "Corporate",
              "Real Estate",
              "Employment",
              "Arbitration",
              "Tax",
            ],
            courts: [
              "Cairo Economic Court",
              "Cairo Court of Appeal",
              "South Cairo Primary Court",
              "Giza Primary Court",
              "Alexandria Economic Court",
            ],
            standard_rates: sql`${JSON.stringify([
              { role: "Managing Partner", hourlyRate: 4500, currency: "EGP" },
              { role: "Partner", hourlyRate: 3500, currency: "EGP" },
              { role: "Senior Associate", hourlyRate: 2200, currency: "EGP" },
              { role: "Associate", hourlyRate: 1500, currency: "EGP" },
              { role: "Paralegal", hourlyRate: 700, currency: "EGP" },
            ])}::jsonb`,
            ai_assistant_enabled: true,
          })
          .execute();

        for (const t of DEMO_TEAM) {
          await ex
            .insertInto("lawfirm_staff_profiles")
            .values({
              id: lawfirmId("stf"),
              organization_id: orgId,
              user_id: userId.get(t.key)!,
              title: t.title,
              phone: t.phone,
              practice_areas: [...t.practiceAreas],
              status: t.status,
              weekly_capacity_hours: t.weeklyCapacityHours,
              bar_admission: t.bar,
            })
            .execute();
        }

        const clientId = new Map<string, string>();
        for (const c of DEMO_CLIENTS) {
          const id = lawfirmId("cli");
          clientId.set(c.key, id);
          await ex
            .insertInto("lawfirm_clients")
            .values({
              id,
              organization_id: orgId,
              name: c.name,
              type: c.type,
              status: c.status,
              email: c.email,
              phone: c.phone,
              tax_id: c.taxId,
              address: c.address,
              notes: c.notes,
              created_at: at(c.createdDays),
            })
            .execute();
        }

        for (const k of DEMO_CONTACTS) {
          await ex
            .insertInto("lawfirm_contacts")
            .values({
              id: lawfirmId("cnt"),
              organization_id: orgId,
              client_id: clientId.get(k.clientKey)!,
              name: k.name,
              role: k.role,
              email: k.email,
              phone: k.phone,
              is_primary: k.primary,
            })
            .execute();
        }

        const matterId = new Map<string, string>();
        for (const m of DEMO_MATTERS) {
          const id = lawfirmId("mat");
          matterId.set(m.key, id);
          await ex
            .insertInto("lawfirm_matters")
            .values({
              id,
              organization_id: orgId,
              reference: m.reference,
              title: m.title,
              client_id: clientId.get(m.clientKey)!,
              practice_area: m.practiceArea,
              status: m.status,
              court: m.court,
              lead_lawyer_id: userId.get(m.leadKey)!,
              opened_at: at(m.openedDays),
              closed_at: m.closedDays === null ? null : at(m.closedDays),
              description: m.description,
            })
            .execute();
        }

        for (const p of DEMO_PARTICIPANTS) {
          await ex
            .insertInto("lawfirm_matter_participants")
            .values({
              id: lawfirmId("mpt"),
              organization_id: orgId,
              matter_id: matterId.get(p.matterKey)!,
              user_id: userId.get(p.userKey)!,
              role: p.role,
            })
            .execute();
        }

        const updateIds: Array<{ id: string; documentNames: readonly string[] }> = [];
        for (const u of DEMO_UPDATES) {
          const id = lawfirmId("mup");
          updateIds.push({ id, documentNames: u.documentNames });
          await ex
            .insertInto("lawfirm_matter_updates")
            .values({
              id,
              organization_id: orgId,
              matter_id: matterId.get(u.matterKey)!,
              author_id: userId.get(u.authorKey)!,
              body: u.body,
              created_at: at(u.days),
            })
            .execute();
        }

        for (const n of DEMO_NOTES) {
          await ex
            .insertInto("lawfirm_matter_notes")
            .values({
              id: lawfirmId("mnt"),
              organization_id: orgId,
              matter_id: matterId.get(n.matterKey)!,
              author_id: userId.get(n.authorKey)!,
              body: n.body,
              created_at: at(n.days),
              updated_at: at(n.days),
            })
            .execute();
        }

        for (const h of DEMO_HEARINGS) {
          await ex
            .insertInto("lawfirm_hearings")
            .values({
              id: lawfirmId("hrg"),
              organization_id: orgId,
              matter_id: matterId.get(h.matterKey)!,
              court: h.court,
              scheduled_at: at(h.days, h.hour),
              status: h.status,
              purpose: h.purpose,
              outcome: h.outcome,
            })
            .execute();
        }

        for (const t of DEMO_TASKS) {
          await ex
            .insertInto("lawfirm_tasks")
            .values({
              id: lawfirmId("tsk"),
              organization_id: orgId,
              title: t.title,
              matter_id: t.matterKey ? matterId.get(t.matterKey)! : null,
              assignee_id: t.assigneeKey ? userId.get(t.assigneeKey)! : null,
              status: t.status,
              priority: t.priority,
              due_at: t.days === null ? null : at(t.days),
              created_at: at(t.createdDays),
              completed_at: t.completedDays === null ? null : at(t.completedDays),
            })
            .execute();
        }

        const documentIdByName = new Map<string, string>();
        for (const d of DEMO_DOCUMENTS) {
          const id = lawfirmId("cdoc");
          documentIdByName.set(d.name, id);
          await ex
            .insertInto("lawfirm_documents")
            .values({
              id,
              organization_id: orgId,
              name: d.name,
              matter_id: matterId.get(d.matterKey)!,
              category: d.category,
              status: d.status,
              file_id: `${lawfirmId("cdoc")}-demo`,
              size_bytes: d.size,
              mime_type: d.mime,
              uploaded_by_id: userId.get(d.byKey)!,
              uploaded_at: at(d.days),
            })
            .execute();
        }

        for (const u of updateIds) {
          for (const name of u.documentNames) {
            const documentId = documentIdByName.get(name);
            if (!documentId) continue;
            await ex
              .insertInto("lawfirm_matter_update_files")
              .values({
                id: lawfirmId("muf"),
                organization_id: orgId,
                matter_update_id: u.id,
                document_id: documentId,
              })
              .execute();
          }
        }

        const invoiceId = new Map<string, string>();
        for (const inv of DEMO_INVOICES) {
          const id = lawfirmId("inv");
          invoiceId.set(inv.key, id);
          await ex
            .insertInto("lawfirm_invoices")
            .values({
              id,
              organization_id: orgId,
              number: inv.number,
              client_id: clientId.get(inv.clientKey)!,
              matter_id: matterId.get(inv.matterKey)!,
              status: inv.status,
              currency: inv.currency,
              issued_at: inv.issuedDays === null ? null : at(inv.issuedDays),
              due_at: inv.dueDays === null ? null : at(inv.dueDays),
              vat_rate: String(inv.vatRate),
            })
            .execute();
          for (const l of inv.lines) {
            await ex
              .insertInto("lawfirm_invoice_lines")
              .values({
                id: lawfirmId("ifl"),
                organization_id: orgId,
                invoice_id: id,
                kind: l.kind,
                description: l.description,
                amount: String(l.amount),
              })
              .execute();
          }
        }

        for (const p of DEMO_PAYMENTS) {
          await ex
            .insertInto("lawfirm_payments")
            .values({
              id: lawfirmId("pay"),
              organization_id: orgId,
              invoice_id: invoiceId.get(p.invoiceKey)!,
              amount: String(p.amount),
              currency: p.currency,
              method: p.method,
              received_at: at(p.days),
              reference: p.reference,
            })
            .execute();
        }

        for (const e of DEMO_EXPENSES) {
          await ex
            .insertInto("lawfirm_expenses")
            .values({
              id: lawfirmId("exp"),
              organization_id: orgId,
              matter_id: e.matterKey ? matterId.get(e.matterKey)! : null,
              description: e.description,
              category: e.category,
              amount: String(e.amount),
              currency: e.currency,
              status: e.status,
              incurred_at: at(e.days),
              submitted_by_id: userId.get(e.byKey)!,
            })
            .execute();
        }

        for (const e of DEMO_EVENTS) {
          await ex
            .insertInto("lawfirm_calendar_events")
            .values({
              id: lawfirmId("cal"),
              organization_id: orgId,
              title: e.title,
              kind: e.kind,
              start_at: at(e.startDays, e.startHour),
              end_at: e.endHour === null ? null : at(e.startDays, e.endHour),
              matter_id: e.matterKey ? matterId.get(e.matterKey)! : null,
              owner_id: userId.get(e.ownerKey)!,
            })
            .execute();
        }

        for (const a of DEMO_ACTIVITY) {
          await ex
            .insertInto("lawfirm_activity_entries")
            .values({
              id: lawfirmId("act"),
              organization_id: orgId,
              actor_id: userId.get(a.actorKey)!,
              action: a.action,
              target_type: a.targetType,
              target_id: a.targetKey ? (matterId.get(a.targetKey) ?? a.targetKey) : "n/a",
              target_label: a.label,
              at: at(a.days),
            })
            .execute();
        }

        for (const n of DEMO_NOTIFICATIONS) {
          const mid = n.matterKey ? matterId.get(n.matterKey) : null;
          const createdAt = new Date(now.getTime() - n.hoursAgo * 3_600_000);
          await ex
            .insertInto("notifications")
            .values({
              id: newId("ntf"),
              user_id: userId.get("usr_dev")!,
              organization_id: orgId,
              type: n.type,
              title: n.title,
              body: n.body,
              locale: "en",
              data: mid ? sql`${JSON.stringify({ matterId: mid })}::jsonb` : null,
              read_at: n.read ? new Date(now.getTime() - (n.hoursAgo - 1) * 3_600_000) : null,
              created_at: createdAt,
            })
            .execute();
        }
      }),
    );

    log.info({ orgId, users: DEMO_TEAM.length }, "Mizan demo data seeded");
  }
}
