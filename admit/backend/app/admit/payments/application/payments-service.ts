import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, FILE_STORAGE, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IFileStorage } from "@core/contracts/index.js";
import type { Principal } from "@core/http/principal.js";
import { readAdmitConfig } from "@admit/config.js";
import { EventAccess } from "@admit/admit/events/application/event-access.js";
import { EventsRepository } from "@admit/admit/events/infrastructure/events-repository.js";
import { BookingsRepository, type BookingRecord } from "@admit/admit/bookings/infrastructure/bookings-repository.js";
import { BookingsService } from "@admit/admit/bookings/application/bookings-service.js";
import { TicketsService } from "@admit/admit/tickets/application/tickets-service.js";
import { EmailComposer } from "@admit/admit/emails/application/email-composer.js";
import { PaymentsRepository, type SubmissionRecord } from "../infrastructure/payments-repository.js";
import type { ApproveBody, ProofPresignBody, RejectBody, SubmitProofBody } from "../validation/payments.schema.js";

/** Core's FILE_STORAGE binding is the concrete FileStorageService; Admit needs two members the IFileStorage contract does not list. */
interface ProofStore extends IFileStorage {
  getMetadata(id: string): Promise<{ metadata: Record<string, unknown> | null; status: "pending" | "stored" }>;
  writeBytes(id: string, content: Buffer): Promise<void>;
}

/** How long a reviewer's soft lock lasts without a heartbeat. */
export const CLAIM_TTL_MS = 5 * 60_000;

export const PROOF_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif", "application/pdf"] as const;

export interface QueueItem {
  submissionId: string;
  version: number;
  bookingId: string;
  bookingRef: string;
  customer: string;
  eventId: string;
  eventTitle: string;
  amountMinor: number;
  currency: string;
  method: string | null;
  submittedAt: Date;
  flags: Array<"amount_mismatch" | "duplicate_transaction" | "resubmission">;
  lock: { by: string; byName: string | null; at: Date } | null;
}

export interface DecisionResult {
  submissionId: string;
  status: SubmissionRecord["status"];
  bookingStatus: BookingRecord["status"];
  ticketsIssued: number;
  decidedAt: Date | null;
  replayed: boolean;
}

/**
 * Manual payment verification. The customer sends money outside the system and uploads proof; staff with the
 * right permission approve or reject it. Decisions are version-checked (`WHERE status = 'SUBMITTED' AND version = $v`),
 * idempotent per client key, and approval issues the tickets and queues the confirmation email in the SAME transaction:
 * either the booking is CONFIRMED with all its tickets, or nothing happened.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository,
    private readonly bookings: BookingsRepository,
    private readonly bookingsService: BookingsService,
    private readonly events: EventsRepository,
    private readonly tickets: TicketsService,
    private readonly composer: EmailComposer,
    private readonly access: EventAccess,
    @Inject(FILE_STORAGE) private readonly files: ProofStore,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  // ---- guest: proof upload --------------------------------------------------------------------
  private async payable(ref: string, secret: string): Promise<BookingRecord> {
    const { booking } = await this.bookingsService.guest(ref, secret);
    if (booking.status !== "AWAITING_PAYMENT") {
      throw Conflict(
        "admit.booking_state",
        booking.status === "IN_REVIEW" ? "Your proof is already being reviewed." : "This booking is not waiting for payment.",
      );
    }
    if (booking.holdExpiresAt <= this.clock.now()) throw Conflict("admit.hold_expired", "The time to pay for this booking has run out.");
    await this.assertEventOpen(booking.eventId, "The organizer cancelled this event, so payments are no longer accepted. Contact the organizer.");
    return booking;
  }

  /** A cancelled or archived event takes no more money and issues no more tickets. */
  private async assertEventOpen(eventId: string, message: string): Promise<void> {
    const e = await this.events.findEvent(eventId);
    if (e && (e.status === "cancelled" || e.status === "archived")) throw Conflict("admit.event_closed", message);
  }

  /** Step 1: ask where to PUT the proof. Validates type and size before anything is stored. */
  async presign(ref: string, secret: string, b: ProofPresignBody) {
    const booking = await readInTenant(() => this.payable(ref, secret));
    const max = readAdmitConfig().proofMaxBytes;
    if (b.byteSize > max) {
      throw ValidationError(
        "admit.proof_too_large",
        `This file is ${Math.ceil(b.byteSize / 1_048_576)} MB. Upload one under ${Math.floor(max / 1_048_576)} MB.`,
        { fields: [{ path: "file", message: `This file is ${Math.ceil(b.byteSize / 1_048_576)} MB. Upload one under ${Math.floor(max / 1_048_576)} MB.` }] },
      );
    }
    if (!(PROOF_TYPES as readonly string[]).includes(b.contentType)) {
      throw ValidationError("admit.proof_type", "Upload a photo (JPG, PNG, HEIC) or a PDF.", {
        fields: [{ path: "file", message: "Upload a photo (JPG, PNG, HEIC) or a PDF." }],
      });
    }
    const out = await this.files.createUpload({
      originalName: b.fileName.slice(0, 120),
      contentType: b.contentType,
      byteSize: b.byteSize,
      visibility: "private",
      metadata: { kind: "payment_proof", bookingId: booking.id },
    });
    return out;
  }

  /** Local driver only: the guest cannot authenticate against the files loopback route, so Admit accepts the bytes for its own pending proof. */
  async writeLocalBytes(ref: string, secret: string, fileId: string, content: Buffer): Promise<void> {
    const booking = await readInTenant(() => this.payable(ref, secret));
    await this.assertOwnFile(fileId, booking.id);
    if (content.byteLength > readAdmitConfig().proofMaxBytes) throw ValidationError("admit.proof_too_large", "That file is too large.");
    await this.files.writeBytes(fileId, content);
  }

  /** A guest may only attach files that THIS booking asked to upload (`metadata.bookingId`), never someone else's file id. */
  private async assertOwnFile(fileId: string, bookingId: string): Promise<void> {
    const meta = await this.files.getMetadata(fileId).catch(() => null);
    const m = (meta?.metadata ?? {}) as { kind?: string; bookingId?: string };
    if (!meta || m.kind !== "payment_proof" || m.bookingId !== bookingId) throw NotFound("admit.file_not_found", "That upload was not found for this booking.");
  }

  /** Step 2: the upload finished; attach it to the booking as a new submission. */
  async submit(ref: string, secret: string, b: SubmitProofBody) {
    const pre = await readInTenant(() => this.payable(ref, secret));
    await readInTenant(() => this.assertOwnFile(b.fileId, pre.id));
    await this.files.confirmUpload(b.fileId); // verifies the bytes really landed; outside the DB transaction (it talks to storage)

    return this.uow.transaction(async () => {
      const booking = (await this.bookings.lock(pre.id))!;
      if (booking.status !== "AWAITING_PAYMENT") throw Conflict("admit.booking_state", "Your proof is already being reviewed.");
      const now = this.clock.now();
      if (booking.holdExpiresAt <= now) throw Conflict("admit.hold_expired", "The time to pay for this booking has run out.");
      if (b.methodId && !(await this.events.findMethod(b.methodId)))
        throw ValidationError("admit.payment_method_not_found", "Choose one of the listed payment methods.");
      await this.repo.supersedeOpen(booking.id);
      const id = await this.repo.insert({
        bookingId: booking.id,
        methodId: b.methodId ?? null,
        fileId: b.fileId,
        txnId: b.transactionId ?? null,
        sentFrom: b.sentFrom ?? null,
        amountMinor: b.amountMinor ?? null,
      });
      await this.bookings.transition(booking.id, ["AWAITING_PAYMENT"], "IN_REVIEW", { rejectionReason: null });
      await this.bookings.addTimeline(booking.id, "Payment proof submitted", { at: now });
      await this.bookings.addTimeline(booking.id, "Waiting for review", { state: "pending", at: now });
      await this.composer.proofReceived(booking.id, id);
      await this.audit.record({
        actorId: null,
        actorType: "system",
        action: "admit.payment.submitted",
        resourceType: "admit_payment_submission",
        resourceId: id,
        after: { bookingId: booking.id },
      });
      return { submissionId: id, status: "IN_REVIEW" as const };
    });
  }

  // ---- review ---------------------------------------------------------------------------------
  async queue(who: Principal, f: { eventId?: string }): Promise<QueueItem[]> {
    return readInTenant(async () => {
      const scope = await this.access.scope(who);
      if (f.eventId && scope && !scope.includes(f.eventId)) return [];
      const subs = await this.repo.queue(scope, { eventId: f.eventId });
      return this.toQueue(subs);
    });
  }

  private async toQueue(subs: Array<SubmissionRecord & { eventId: string }>): Promise<QueueItem[]> {
    const [bookings, events] = await Promise.all([
      this.bookings.byIds([...new Set(subs.map((s) => s.bookingId))]),
      Promise.all([...new Set(subs.map((s) => s.eventId))].map((id) => this.events.findEvent(id))),
    ]);
    const bk = new Map(bookings.map((b) => [b.id, b]));
    const ev = new Map(events.filter((e) => !!e).map((e) => [e!.id, e!]));
    const methods = await this.events.listMethods([...ev.keys()]);
    const mn = new Map(methods.map((m) => [m.id, m.label]));
    const txnCount = new Map<string, number>();
    for (const s of subs) if (s.txnId) txnCount.set(s.txnId, (txnCount.get(s.txnId) ?? 0) + 1);
    return subs.map((s) => {
      const b = bk.get(s.bookingId)!;
      const flags: QueueItem["flags"] = [];
      if (s.amountMinor != null && s.amountMinor !== b.totalMinor) flags.push("amount_mismatch");
      if (s.txnId && (txnCount.get(s.txnId) ?? 0) > 1) flags.push("duplicate_transaction");
      return {
        submissionId: s.id,
        version: s.version,
        bookingId: b.id,
        bookingRef: b.ref,
        customer: b.customerName,
        eventId: s.eventId,
        eventTitle: ev.get(s.eventId)?.title ?? "",
        amountMinor: b.totalMinor,
        currency: b.currency,
        method: s.methodId ? (mn.get(s.methodId) ?? null) : null,
        submittedAt: s.createdAt,
        flags,
        lock:
          s.claimedBy && s.claimedAt && this.clock.now().getTime() - s.claimedAt.getTime() < CLAIM_TTL_MS
            ? { by: s.claimedBy, byName: null, at: s.claimedAt }
            : null,
      };
    });
  }

  async detail(who: Principal, id: string) {
    return readInTenant(async () => {
      const s = await this.repo.find(id);
      if (!s) throw NotFound("admit.submission_not_found", "Payment not found.");
      const booking = (await this.bookings.find(s.bookingId))!;
      await this.access.assertEvent(who, booking.eventId);
      const [item] = await this.toQueue([{ ...s, eventId: booking.eventId }]);
      const history = await this.repo.historyForBooking(booking.id);
      return {
        ...item!,
        status: s.status,
        txnId: s.txnId,
        sentFrom: s.sentFrom,
        declaredAmountMinor: s.amountMinor,
        bookingStatus: booking.status,
        proofUrl: `/api/admit/payments/${s.id}/proof`,
        history: history.map((h) => ({
          id: h.id,
          status: h.status,
          at: h.createdAt,
          decidedAt: h.decidedAt,
          customerReason: h.customerReason,
          internalNote: h.internalNote,
        })),
      };
    });
  }

  /** The proof file, streamed through the API so every view is permission-checked and tenant-scoped. */
  async proof(who: Principal, id: string): Promise<{ content: Buffer; contentType: string; name: string }> {
    const fileId = await readInTenant(async () => {
      const s = await this.repo.find(id);
      if (!s) throw NotFound("admit.submission_not_found", "Payment not found.");
      const booking = (await this.bookings.find(s.bookingId))!;
      await this.access.assertEvent(who, booking.eventId);
      return s.fileId;
    });
    const { content, ref } = await readInTenant(() => this.files.getContent({ id: fileId }));
    return { content, contentType: ref.contentType, name: ref.originalName };
  }

  /** Soft lock / heartbeat. Advisory only: the version check on decide is the real protection. */
  async claim(who: Principal, id: string) {
    return this.uow.transaction(async () => {
      const s = await this.repo.find(id);
      if (!s) throw NotFound("admit.submission_not_found", "Payment not found.");
      const booking = (await this.bookings.find(s.bookingId))!;
      await this.access.assertEvent(who, booking.eventId);
      if (s.status !== "SUBMITTED")
        throw Conflict("admit.payment_changed", "This payment was already decided.", { status: s.status, decidedBy: s.decidedBy, decidedAt: s.decidedAt });
      const held = await this.repo.claim(id, who.userId, this.clock.now(), CLAIM_TTL_MS);
      return { heldByMe: held.claimedBy === who.userId, claimedBy: held.claimedBy, claimedAt: held.claimedAt, version: s.version };
    });
  }
  async release(who: Principal, id: string): Promise<void> {
    await this.uow.transaction(() => this.repo.release(id, who.userId));
  }

  async approve(who: Principal, id: string, b: ApproveBody): Promise<DecisionResult> {
    return this.decide(who, id, b.version, b.idempotencyKey, async (booking, sub, now) => {
      if (
        !(await this.repo.decide(id, b.version, "APPROVED", {
          by: who.userId,
          at: now,
          customerReason: null,
          internalNote: b.internalNote ?? null,
          decisionKey: b.idempotencyKey,
        }))
      ) {
        throw this.changed(sub);
      }
      await this.assertEventOpen(booking.eventId, "This event was cancelled, so tickets cannot be issued. Reject the payment or cancel the booking instead.");
      if (!(await this.bookings.transition(booking.id, ["IN_REVIEW"], "CONFIRMED", { confirmedAt: now })))
        throw Conflict("admit.booking_changed", "This booking just changed. Reload and try again.");
      const issued = await this.tickets.issueForBooking(booking);
      await this.bookings.addTimeline(booking.id, "Payment approved", { actorId: who.userId, at: now });
      await this.bookings.addTimeline(booking.id, "Tickets issued", { actorId: who.userId, at: now });
      await this.composer.ticketsIssued(booking.id);
      await this.audit.record({
        actorId: who.userId,
        action: "admit.payment.approved",
        resourceType: "admit_payment_submission",
        resourceId: id,
        after: { bookingId: booking.id, tickets: issued },
      });
      return { status: "APPROVED" as const, bookingStatus: "CONFIRMED" as const, ticketsIssued: issued };
    });
  }

  async reject(who: Principal, id: string, b: RejectBody): Promise<DecisionResult> {
    return this.decide(who, id, b.version, b.idempotencyKey, async (booking, sub, now) => {
      if (
        !(await this.repo.decide(id, b.version, "REJECTED", {
          by: who.userId,
          at: now,
          customerReason: b.reason,
          internalNote: b.internalNote ?? null,
          decisionKey: b.idempotencyKey,
        }))
      ) {
        throw this.changed(sub);
      }
      const event = (await this.events.findEvent(booking.eventId))!;
      // A rejected customer may fix the problem while the hold lasts; otherwise the seats go back on sale.
      const resubmit = event.allowResubmission && booking.holdExpiresAt > now;
      const to = resubmit ? "AWAITING_PAYMENT" : "REJECTED";
      if (!(await this.bookings.transition(booking.id, ["IN_REVIEW"], to, { rejectionReason: b.reason })))
        throw Conflict("admit.booking_changed", "This booking just changed. Reload and try again.");
      await this.bookings.addTimeline(booking.id, "Payment rejected", { state: "failed", actorId: who.userId, note: b.reason, at: now });
      if (resubmit) await this.bookings.addTimeline(booking.id, "Waiting for a new payment proof", { state: "pending", at: now });
      await this.composer.rejected(booking.id, id, b.reason, resubmit);
      await this.audit.record({
        actorId: who.userId,
        action: "admit.payment.rejected",
        resourceType: "admit_payment_submission",
        resourceId: id,
        after: { bookingId: booking.id, resubmit },
      });
      return { status: "REJECTED" as const, bookingStatus: to as BookingRecord["status"], ticketsIssued: 0 };
    });
  }

  private changed(sub: SubmissionRecord): Error {
    return Conflict("admit.payment_changed", "This booking changed while you were looking at it.", {
      status: sub.status,
      decidedBy: sub.decidedBy,
      decidedAt: sub.decidedAt,
    });
  }

  private async decide(
    who: Principal,
    id: string,
    version: number,
    key: string,
    run: (
      booking: BookingRecord,
      sub: SubmissionRecord,
      now: Date,
    ) => Promise<{ status: SubmissionRecord["status"]; bookingStatus: BookingRecord["status"]; ticketsIssued: number }>,
  ): Promise<DecisionResult> {
    return this.uow.transaction(async () => {
      const seen = await this.repo.find(id);
      if (!seen) throw NotFound("admit.submission_not_found", "Payment not found.");
      const booking0 = (await this.bookings.find(seen.bookingId))!;
      await this.access.assertEvent(who, booking0.eventId);

      // A repeated request (double click, retry) returns the first result rather than a conflict.
      const prior = await this.repo.findByDecisionKey(key);
      if (prior) {
        const b = (await this.bookings.find(prior.bookingId))!;
        return {
          submissionId: prior.id,
          status: prior.status,
          bookingStatus: b.status,
          ticketsIssued: await this.tickets.countFor(b.id),
          decidedAt: prior.decidedAt,
          replayed: true,
        };
      }
      const booking = (await this.bookings.lock(seen.bookingId))!;
      const sub = (await this.repo.lock(id))!;
      if (sub.status !== "SUBMITTED" || sub.version !== version) throw this.changed(sub);
      if (booking.status !== "IN_REVIEW") throw Conflict("admit.booking_changed", "This booking just changed. Reload and try again.");
      const now = this.clock.now();
      const out = await run(booking, sub, now);
      return { submissionId: id, ...out, decidedAt: now, replayed: false };
    });
  }

  validateReason(reason: string): void {
    if (reason.trim().length < 10 || reason.trim().length > 500) throw ValidationError("admit.reason", "Tell the customer what to fix (10-500 characters).");
  }
}
