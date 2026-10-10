import { Inject, Injectable } from "@nestjs/common";
import QRCode from "qrcode";
import { sql } from "kysely";
import { currentExecutor, unitOfWork } from "@core/kernel/db/db.js";
import { newId } from "@core/kernel/id.js";
import { FILE_STORAGE } from "@core/kernel/tokens.js";
import { runAsSystem, withContext } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { argon2Hasher } from "@core/identity/infrastructure/password-hasher.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import type { IFileStorage } from "@core/contracts/index.js";
import type { Principal } from "@core/http/principal.js";
import type { Clock } from "@core/kernel/clock.js";
import { admitDb } from "@admit/admit/db/executor.js";
import { accessSecret, ticketToken } from "@admit/admit/shared/secrets.js";
import { readAdmitConfig } from "@admit/config.js";
import { SettingsService } from "@admit/admit/settings/application/settings-service.js";
import { EventsService } from "@admit/admit/events/application/events-service.js";
import { BookingsService } from "@admit/admit/bookings/application/bookings-service.js";
import { PaymentsService } from "@admit/admit/payments/application/payments-service.js";
import { CheckinService } from "@admit/admit/checkin/application/checkin-service.js";
import { StaffService } from "@admit/admit/staff/application/staff-service.js";
import { PublicService } from "@admit/admit/public/application/public-service.js";
import { DEMO_BOOKINGS, DEMO_CUSTOMERS, DEMO_EVENTS, DEMO_METHODS, DEMO_ORG, DEMO_PASSWORD, DEMO_STAFF, DEMO_VENUES, type DemoBooking } from "./demo-data.js";

const log = moduleLogger("admit-demo-seed");

/**
 * Opt-in demo dataset (`ADMIT_SEED_DEMO=true`, run from `AppSeedService` only). Idempotent: skips entirely if the demo organizer
 * already exists. Staff accounts are inserted directly with a pre-verified email (the demo must be one click from signed-in) and
 * get their roles through Core RBAC; everything Admit-specific - events, bookings, payment decisions, tickets, door scans - is
 * played through the real services, so every invariant, audit entry and queued email is genuine.
 */
@Injectable()
export class DemoSeeder {
  constructor(
    private readonly rbac: RbacService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
    private readonly bookings: BookingsService,
    private readonly payments: PaymentsService,
    private readonly checkin: CheckinService,
    private readonly staff: StaffService,
    private readonly publicApi: PublicService,
    @Inject(FILE_STORAGE) private readonly files: IFileStorage,
  ) {}

  async seed(clock: Clock): Promise<void> {
    const already = await runAsSystem(() => currentExecutor().selectFrom("organizations").select("id").where("slug", "=", DEMO_ORG.slug).executeTakeFirst());
    if (already) {
      log.info("demo organizer already present - skipping");
      return;
    }

    const now = clock.now();
    const orgId = newId("org");
    const userIds = new Map<string, string>();
    const passwordHash = await argon2Hasher.hash(DEMO_PASSWORD);

    await runAsSystem(() =>
      unitOfWork.transaction(async () => {
        const ex = currentExecutor();
        for (const s of DEMO_STAFF) {
          const id = newId("usr");
          userIds.set(s.key, id);
          await ex
            .insertInto("users")
            .values({
              id,
              email: s.email,
              email_normalized: s.email.toLowerCase(),
              password_hash: passwordHash,
              display_name: s.name,
              status: "active",
              email_verified_at: now,
              locale: "en",
            })
            .execute();
        }
        await ex.insertInto("organizations").values({ id: orgId, name: DEMO_ORG.name, slug: DEMO_ORG.slug, settings: {} }).execute();
        for (const s of DEMO_STAFF) {
          await ex
            .insertInto("organization_members")
            .values({ id: newId("mem"), organization_id: orgId, user_id: userIds.get(s.key)!, membership_role: s.membershipRole })
            .execute();
        }
      }),
    );
    const ownerId = userIds.get("owner")!;
    for (const s of DEMO_STAFF) await runAsSystem(() => this.rbac.assignRole(userIds.get(s.key)!, s.roleKey, ownerId, orgId));

    const who = (key: string): Principal => {
      const s = DEMO_STAFF.find((x) => x.key === key)!;
      return { userId: userIds.get(key)!, email: s.email, organizationId: orgId, permissions: [] };
    };

    await withContext({ userId: ownerId, organizationId: orgId }, async () => {
      await this.settings.update(ownerId, { organizerName: DEMO_ORG.name, supportEmail: DEMO_ORG.supportEmail });

      const venueIds = new Map<string, string>();
      for (const v of DEMO_VENUES)
        venueIds.set(
          v.key,
          (await this.events.createVenue(who("owner"), { name: v.name, area: v.area, address: v.address, mapUrl: null, capacity: v.capacity })).id,
        );

      const eventIds = new Map<string, string>();
      const typeIds = new Map<string, string[]>();
      for (const e of DEMO_EVENTS) {
        const day = new Date(now.getTime() + e.startsInDays * 86_400_000);
        const starts = e.live
          ? new Date(now.getTime() - 3_600_000)
          : new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), e.startHour - 2));
        const ends = new Date(starts.getTime() + e.hours * 3_600_000);
        const created = await this.events.create(who("owner"), {
          slug: e.slug,
          title: e.title,
          category: e.category,
          description: e.description,
          venueId: venueIds.get(e.venue)!,
          startsAt: starts,
          endsAt: ends,
          coverUrl: null,
          maxPerBooking: 6,
          namedTickets: e.namedTickets,
          holdHours: 24,
          allowResubmission: true,
          supportEmail: null,
          policies: e.policies ?? {},
          program: e.program ?? [],
        });
        eventIds.set(e.slug, created.id);
        const ids: string[] = [];
        for (const [i, t] of e.types.entries()) {
          ids.push(
            (
              await this.events.createType(who("owner"), created.id, {
                name: t.name,
                description: t.description,
                priceMinor: t.price * 100,
                quantity: t.quantity,
                maxPerBooking: 6,
                onSale: true,
                sortOrder: i,
              })
            ).id,
          );
        }
        typeIds.set(e.slug, ids);
        for (const [i, m] of DEMO_METHODS.entries()) {
          await this.events.createMethod(who("owner"), created.id, {
            ...m,
            enabled: m.type !== "bank" || e.slug === "design-systems-cairo-2026",
            sortOrder: i,
          });
        }
        if (e.publish) await this.events.publish(who("owner"), created.id);
      }

      for (const s of DEMO_STAFF) {
        for (const slug of s.events ?? []) {
          for (const [evSlug, evId] of eventIds) {
            if (slug === "*" || slug === evSlug) await this.staff.assign(who("owner"), evId, userIds.get(s.key)!, s.gate ?? "");
          }
        }
      }

      // ---- bookings, played through the real services --------------------------------------------------------
      let n = 0;
      for (const b of DEMO_BOOKINGS) await this.play(b, ++n, typeIds, who);
    });

    await this.settleEmails();
    log.info({ organizer: DEMO_ORG.slug, staff: DEMO_STAFF.length, events: DEMO_EVENTS.length, bookings: DEMO_BOOKINGS.length }, "admit demo seeded");
  }

  private async play(b: DemoBooking, n: number, typeIds: Map<string, string[]>, who: (k: string) => Principal): Promise<void> {
    const c = DEMO_CUSTOMERS[b.customer]!;
    const types = typeIds.get(b.event)!;
    const { booking } = await this.bookings.create(
      b.event,
      {
        items: b.qty.map(([i, q]) => ({ ticketTypeId: types[i]!, quantity: q, holderNames: b.holders?.slice(0, q) })),
        customer: { name: c.name, email: c.email, phone: c.phone },
        policyAck: true,
      },
      `demo-booking-${n}-${b.event}`,
    );
    const secret = accessSecret(booking.id);
    const reviewer = who("finance");

    const submitProof = async () => {
      const png = await QRCode.toBuffer(`DEMO RECEIPT ${booking.ref} EGP ${(booking.totalMinor / 100).toFixed(2)}`, { type: "png", width: 360, margin: 2 });
      const stored = await this.files.upload({
        content: png,
        originalName: "instapay-receipt.png",
        contentType: "image/png",
        visibility: "private",
        metadata: { kind: "payment_proof", bookingId: booking.id },
      });
      const methods = await this.events.get(who("owner"), booking.eventId);
      await this.payments.submit(booking.ref, secret, {
        fileId: stored.id,
        methodId: methods.paymentMethods[0]?.id ?? null,
        transactionId: `${4800 + n} 1150 ${30 + n}`,
        sentFrom: c.name,
        amountMinor: booking.totalMinor,
      });
    };
    const openSubmission = async () => (await this.payments.queue(reviewer, {})).find((q) => q.bookingRef === booking.ref)!;
    const approve = async () => {
      const q = await openSubmission();
      await this.payments.approve(reviewer, q.submissionId, {
        version: q.version,
        idempotencyKey: `demo-approve-${booking.id}`,
        internalNote: "Found in the InstaPay account.",
      });
    };

    switch (b.outcome) {
      case "awaiting":
        break;
      case "in_review":
        await submitProof();
        break;
      case "confirmed":
      case "email_failed":
        await submitProof();
        await approve();
        break;
      case "rejected_open":
      case "rejected_resubmitted": {
        await submitProof();
        const q = await openSubmission();
        await this.payments.reject(reviewer, q.submissionId, {
          version: q.version,
          idempotencyKey: `demo-reject-${booking.id}`,
          reason: "The screenshot shows a different amount from the total due. Please transfer the difference and upload both receipts.",
          internalNote: "Short by 150 EGP.",
        });
        if (b.outcome === "rejected_resubmitted") await submitProof();
        break;
      }
      case "expired":
        await runAsSystem(() =>
          unitOfWork.transaction(() =>
            admitDb()
              .updateTable("admit_bookings")
              .set({ hold_expires_at: new Date(Date.now() - 3_600_000) })
              .where("id", "=", booking.id)
              .execute(),
          ),
        );
        await this.bookings.expireLapsedHolds();
        break;
      case "cancelled":
        await this.bookings.cancelByGuest(booking.ref, secret);
        break;
    }

    // Door scans for the event that is on tonight.
    if (b.checkedIn) {
      const tickets = await this.publicApi.ticketsFor(DEMO_ORG.slug, booking.ref, secret);
      const door = who("door");
      const eventId = booking.eventId;
      for (const t of tickets.tickets.slice(0, b.checkedIn)) {
        await this.checkin.scan(door, { token: ticketToken(t.id), eventId });
      }
    }

    if (b.outcome === "email_failed") {
      await runAsSystem(() =>
        unitOfWork.transaction(() =>
          admitDb()
            .updateTable("admit_email_messages")
            .set({ status: "FAILED", attempts: 3, last_error: "550 5.1.1 mailbox unavailable (hard bounce) - check the address" })
            .where("booking_id", "=", booking.id)
            .where("type", "=", "TICKETS")
            .execute(),
        ),
      );
    }

    // Spread the history over the past days so the sales chart and "recent bookings" read like a real week.
    if (b.daysAgo > 0) {
      const d = sql`interval '1 day' * ${b.daysAgo} + interval '1 minute' * ${(n * 37) % 600}`;
      await runAsSystem(() =>
        unitOfWork.transaction(async () => {
          const db = admitDb();
          await db
            .updateTable("admit_bookings")
            .set({ created_at: sql`created_at - ${d}`, confirmed_at: sql`confirmed_at - ${d}` })
            .where("id", "=", booking.id)
            .execute();
          await db
            .updateTable("admit_booking_timeline")
            .set({ at: sql`at - ${d}` })
            .where("booking_id", "=", booking.id)
            .execute();
          await db
            .updateTable("admit_payment_submissions")
            .set({ created_at: sql`created_at - ${d}`, decided_at: sql`decided_at - ${d}` })
            .where("booking_id", "=", booking.id)
            .execute();
          await db
            .updateTable("admit_tickets")
            .set({ created_at: sql`created_at - ${d}` })
            .where("booking_id", "=", booking.id)
            .execute();
          await db
            .updateTable("admit_email_messages")
            .set({ created_at: sql`created_at - ${d}` })
            .where("booking_id", "=", booking.id)
            .execute();
        }),
      );
    }
  }

  /** Make the outbox look lived-in: older mail was delivered long ago, today's is still queued for the worker. */
  private async settleEmails(): Promise<void> {
    await runAsSystem(() =>
      unitOfWork.transaction(async () => {
        const db = admitDb();
        // one rejection notice is mid-retry (the relay timed out), so the delivery screen shows a retrying message
        await db
          .updateTable("admit_email_messages")
          .set({ status: "RETRYING", attempts: 2, last_error: "Connection timeout to SMTP relay", next_attempt_at: new Date(Date.now() + 10 * 60_000) })
          .where("id", "in", db.selectFrom("admit_email_messages").select("id").where("type", "=", "REJECTED").where("status", "=", "QUEUED").limit(1))
          .execute();
        await db
          .updateTable("admit_email_messages")
          .set({
            status: "ACCEPTED",
            attempts: 1,
            sent_at: sql`created_at + interval '2 seconds'`,
            provider_message_id: sql`'<demo-' || id || '@admit.example>'`,
          })
          .where("status", "=", "QUEUED")
          .where("created_at", "<", new Date(Date.now() - 6 * 3_600_000))
          .execute();
      }),
    );
    void readAdmitConfig;
  }
}
