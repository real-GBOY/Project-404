import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { AUDIT_LOGGER, CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { defineEvent } from "@core/contracts/index.js";
import { UserDirectory } from "@core/identity/application/user-directory.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { permissionMatches } from "@core/rbac/domain/permission.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import {
  ReservationsRepository,
  type ReservationRecord,
} from "@hotel/hotel/reservations/infrastructure/reservations-repository.js";
import { formatStayNight } from "@hotel/hotel/shared/labels.js";
import { formatEgp, toPiastres } from "@hotel/hotel/shared/money.js";
import { addDays, type IsoDate } from "@hotel/hotel/shared/dates.js";
import { isUniqueViolation } from "@hotel/hotel/shared/pg-errors.js";
import {
  allocateRefund,
  expectedRoomTotal,
  folioTotals,
  splitRoomCharges,
  taxFor,
  totalsFromSums,
  type FolioTotals,
} from "../domain/folio.js";
import {
  PAYMENT_PROVIDER,
  type PaymentMethod,
  type PaymentProvider,
} from "../domain/payment-provider.js";
import {
  BillingRepository,
  type ChargeKind,
  type LedgerFilter,
  type PaymentRecord,
  type RefundRecord,
} from "../infrastructure/billing-repository.js";

const IN_HOUSE_EXTRA_KINDS: ReadonlySet<ChargeKind> = new Set([
  "breakfast",
  "extra_bed",
  "minibar",
  "laundry",
  "transfer",
  "service",
]);

/**
 * The guest folio: charges, payments and invoices. The balance is always DERIVED from the ledger
 * (domain/folio.ts). Money only moves through `collectPayment`, which calls the PaymentProvider
 * outside any DB transaction and records its answer — the frontend can never declare a payment.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly reservations: ReservationsRepository,
    private readonly settings: SettingsService,
    private readonly directory: UserDirectory,
    private readonly rbac: RbacService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(EVENT_BUS) private readonly events: IEventBus,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  // ─── reads ────────────────────────────────────────────────────────────────

  folio(reservationId: string) {
    return readInTenant(async () => {
      const r = await this.reservations.findById(reservationId);
      if (!r) throw NotFound("reservation.not_found", "Reservation not found.");
      const [charges, payments, refunds, totals, invoiceId, invoices, credit] = await Promise.all([
        this.repo.charges(reservationId),
        this.repo.payments(reservationId),
        this.repo.refunds(reservationId),
        this.totals(r),
        this.repo.issuedInvoiceFor(reservationId),
        this.repo.invoicesFor(reservationId),
        this.openCredit(r),
      ]);
      const names = await this.directory.userNames([
        ...payments.map((p) => p.receivedBy),
        ...refunds.map((f) => f.refundedBy),
      ]);
      const refundable = new Map(
        (await this.refundablePayments(reservationId)).map((p) => [p.id, p.refundable]),
      );
      return {
        reservationId,
        totals,
        credit,
        invoiceId,
        invoices,
        charges,
        payments: payments.map((p) => ({
          ...p,
          refundable: refundable.get(p.id) ?? 0,
          receivedByName: p.receivedBy ? (names.get(p.receivedBy) ?? null) : null,
        })),
        refunds: refunds.map((f) => ({
          ...f,
          refundedByName: f.refundedBy ? (names.get(f.refundedBy) ?? null) : null,
        })),
      };
    });
  }

  /** Ledger totals for a reservation (inside a tenant transaction). */
  async totals(r: ReservationRecord): Promise<FolioTotals> {
    const [charges, payments, refunds, settings] = await Promise.all([
      this.repo.charges(r.id),
      this.repo.payments(r.id),
      this.repo.refunds(r.id),
      this.settings.operating(),
    ]);
    return folioTotals({
      charges: charges.map((c) => ({
        amount: c.amount,
        taxAmount: c.taxAmount,
        voided: c.voidedAt !== null,
      })),
      completedPayments: payments.filter((p) => p.status === "completed").map((p) => p.amount),
      refunds: refunds.filter((f) => f.status === "completed").map((f) => f.amount),
      expected: { roomTotal: expectedRoomTotal(r.status, r.total), taxRate: settings.taxRate },
    });
  }

  async invoice(id: string) {
    return readInTenant(async () => {
      const inv = await this.repo.invoiceById(id);
      if (!inv) throw NotFound("invoice.not_found", "Invoice not found.");
      const r = (await this.reservations.findById(inv.reservationId))!;
      return {
        ...inv,
        reservation: {
          id: r.id,
          code: r.code,
          roomNumber: r.roomNumber,
          roomTypeName: r.roomTypeName,
          arrival: r.arrival,
          departure: r.departure,
        },
      };
    });
  }

  // ─── charges ──────────────────────────────────────────────────────────────

  /** Post an extra (breakfast, minibar, …) to an in-house guest's folio. */
  postCharge(
    reservationId: string,
    input: { kind: ChargeKind; description: string; quantity: number; unitPrice: number },
    actorId: string,
  ) {
    if (!IN_HOUSE_EXTRA_KINDS.has(input.kind)) {
      throw ValidationError(
        "billing.room_charge_manual",
        "Room nights are posted by check-in, not by hand.",
      );
    }
    return this.uow.transaction(async () => {
      if (!(await this.reservations.lock(reservationId))) {
        throw NotFound("reservation.not_found", "Reservation not found.");
      }
      const r = (await this.reservations.findById(reservationId))!;
      if (r.status !== "checked_in") {
        throw Conflict(
          "billing.not_in_house",
          "Extras can only be posted while the guest is checked in.",
        );
      }
      const settings = await this.settings.operating();
      const amount = input.unitPrice * input.quantity;
      const id = await this.repo.insertCharge({
        reservationId,
        kind: input.kind,
        description: input.description,
        serviceDate: await this.settings.today(),
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        taxAmount: taxFor(amount, settings.taxRate),
        createdBy: actorId,
      });
      await this.audit.record({
        actorId,
        action: "hotel.folio.charge_posted",
        resourceType: "hotel_reservation",
        resourceId: reservationId,
        after: { chargeId: id, kind: input.kind, amount },
      });
      return { id };
    });
  }

  voidCharge(chargeId: string, reason: string, actorId: string) {
    return this.uow.transaction(async () => {
      const charge = await this.repo.findCharge(chargeId);
      if (!charge) throw NotFound("billing.charge_not_found", "Charge not found.");
      await this.reservations.lock(charge.reservationId);
      if (charge.voidedAt) throw Conflict("billing.already_void", "This charge is already void.");
      if (charge.invoiceId) {
        throw Conflict(
          "billing.charge_invoiced",
          "This charge is on an issued invoice and can't be voided.",
        );
      }
      await this.repo.voidCharge(chargeId, this.clock.now(), reason);
      await this.audit.record({
        actorId,
        action: "hotel.folio.charge_voided",
        resourceType: "hotel_reservation",
        resourceId: charge.reservationId,
        before: { chargeId, amount: charge.amount, description: charge.description },
        after: { reason },
      });
      return { ok: true };
    });
  }

  // ─── workflow helpers (inside the caller's transaction) ──────────────────

  /** Check-in: post one room charge per booked night, carrying the booking's discount. */
  async postRoomCharges(r: ReservationRecord, actorId: string): Promise<void> {
    const settings = await this.settings.operating();
    const nights = splitRoomCharges(r.nightlyRates, r.roomTotal, r.total);
    for (const n of nights) {
      await this.repo.insertCharge({
        reservationId: r.id,
        kind: "room",
        description: `Room ${r.roomNumber} · ${r.roomTypeName} · ${formatStayNight(n.date)}`,
        serviceDate: n.date,
        quantity: 1,
        unitPrice: n.amount,
        taxAmount: taxFor(n.amount, settings.taxRate),
        createdBy: actorId,
      });
    }
  }

  /** Early check-out: void the room nights that will not be used. */
  async voidUnusedNights(reservationId: string, fromNight: IsoDate, at: Date): Promise<number> {
    const charges = await this.repo.charges(reservationId);
    const unused = charges.filter(
      (c) => c.kind === "room" && !c.voidedAt && c.serviceDate >= fromNight,
    );
    for (const c of unused)
      await this.repo.voidCharge(c.id, at, "Early check-out — night not used");
    return unused.length;
  }

  /** Check-out: freeze every active charge onto an invoice. */
  async issueInvoice(r: ReservationRecord, actorId: string): Promise<string> {
    const existing = await this.repo.issuedInvoiceFor(r.id);
    if (existing) return existing;
    const settings = await this.settings.operating();
    const charges = (await this.repo.charges(r.id)).filter((c) => !c.voidedAt);
    const subtotal = charges.reduce((s, c) => s + toPiastres(c.amount), 0) / 100;
    const tax = charges.reduce((s, c) => s + toPiastres(c.taxAmount), 0) / 100;
    const id = await this.repo.issueInvoice({
      number: await this.repo.nextInvoiceNumber(),
      reservationId: r.id,
      billToName: r.guestName,
      taxRate: settings.taxRate,
      charges,
      subtotal,
      tax,
      issuedBy: actorId,
    });
    await this.audit.record({
      actorId,
      action: "hotel.invoice.issued",
      resourceType: "hotel_invoice",
      resourceId: id,
      after: { reservationId: r.id, subtotal, tax, total: subtotal + tax },
    });
    await this.events.publish(
      defineEvent("invoice.issued", 1, {
        invoiceId: id,
        reservationId: r.id,
        total: subtotal + tax,
      }),
    );
    return id;
  }

  // ─── payments ─────────────────────────────────────────────────────────────

  /**
   * Take a payment. Three steps, deliberately NOT one transaction:
   *   1. (tx) lock the reservation, check the amount against the outstanding balance — counting
   *      payments already in flight — and write a PENDING payment keyed by `idempotencyKey`;
   *   2. call the PaymentProvider with no transaction open;
   *   3. (tx) record completed/failed, audit it, publish the event.
   * Retrying with the same key returns the original payment instead of charging twice. A crash
   * between 2 and 3 leaves a visible `pending` row for reconciliation — never a silent charge.
   */
  async collectPayment(
    reservationId: string,
    input: { method: PaymentMethod; amount: number; idempotencyKey: string },
    actorId: string,
  ): Promise<PaymentRecord> {
    let paymentId: string;
    try {
      const staged = await this.uow.transaction(async () => {
        const existing = await this.repo.paymentByKey(input.idempotencyKey);
        if (existing) {
          if (existing.reservationId !== reservationId || existing.amount !== input.amount) {
            throw Conflict(
              "payment.idempotency_mismatch",
              "That idempotency key was used for a different payment.",
            );
          }
          return { replay: existing };
        }
        if (!(await this.reservations.lock(reservationId))) {
          throw NotFound("reservation.not_found", "Reservation not found.");
        }
        const r = (await this.reservations.findById(reservationId))!;
        if (!["pending", "confirmed", "checked_in"].includes(r.status)) {
          throw Conflict(
            "payment.not_open",
            `No payments can be taken on a ${r.status.replace("_", " ")} reservation.`,
          );
        }
        const totals = await this.totals(r);
        const inFlight = (await this.repo.payments(r.id))
          .filter((p) => p.status === "pending")
          .reduce((s, p) => s + toPiastres(p.amount), 0);
        const open = toPiastres(totals.balance) - inFlight;
        if (toPiastres(input.amount) > open) {
          throw Conflict(
            "payment.exceeds_balance",
            `That's more than the outstanding balance of ${formatEgp(open / 100)}.`,
            { balance: open / 100 },
          );
        }
        const id = await this.repo.insertPendingPayment({
          reservationId,
          method: input.method,
          amount: input.amount,
          provider: this.provider.name,
          idempotencyKey: input.idempotencyKey,
          businessDate: await this.settings.today(),
          receivedBy: actorId,
        });
        return { id, code: r.code };
      });
      if ("replay" in staged) return staged.replay!;
      paymentId = staged.id;

      const result = await this.provider.charge({
        reference: paymentId,
        amount: input.amount,
        currency: "EGP",
        method: input.method,
        description: `Hotel Transylvania · ${staged.code}`,
      });

      return await this.uow.transaction(async () => {
        await this.repo.resolvePayment(paymentId, { ...result, at: this.clock.now() });
        await this.audit.record({
          actorId,
          action:
            result.status === "completed" ? "hotel.payment.completed" : "hotel.payment.failed",
          resourceType: "hotel_payment",
          resourceId: paymentId,
          after: {
            reservationId,
            method: input.method,
            amount: input.amount,
            provider: this.provider.name,
            ...(result.failureReason && { failureReason: result.failureReason }),
          },
        });
        await this.events.publish(
          defineEvent(result.status === "completed" ? "payment.completed" : "payment.failed", 1, {
            paymentId,
            reservationId,
            amount: input.amount,
            method: input.method,
          }),
        );
        return (await this.repo.paymentById(paymentId))!;
      });
    } catch (err) {
      if (isUniqueViolation(err, "hotel_payments_idempotency_uq")) {
        // A concurrent request with the same key won the insert — hand back its payment.
        const winner = await readInTenant(() => this.repo.paymentByKey(input.idempotencyKey));
        if (winner) return winner;
      }
      throw err;
    }
  }

  // ─── refunds ──────────────────────────────────────────────────────────────

  /**
   * Return an overpayment. Same three steps as a payment: (tx) check it against the folio's
   * credit and write PENDING refund rows against the payments the money came from; (no tx) call
   * the provider for each; (tx) resolve. A refund can only return a CREDIT — money the guest paid
   * beyond what the folio owes — never more than was paid on any one payment.
   */
  async refund(
    reservationId: string,
    input: { amount: number; reason: string; idempotencyKey: string; paymentId?: string | null },
    actorId: string,
  ): Promise<RefundRecord[]> {
    await this.requireRefunder(actorId);
    let staged: RefundRecord[];
    try {
      staged = await this.uow.transaction(async () => {
        const replay = await this.repo.refundsForKey(input.idempotencyKey);
        if (replay.length > 0) {
          const sum = replay.reduce((s, f) => s + toPiastres(f.amount), 0);
          if (replay[0]!.reservationId !== reservationId || sum !== toPiastres(input.amount)) {
            throw Conflict(
              "refund.idempotency_mismatch",
              "That idempotency key was used for a different refund.",
            );
          }
          return replay;
        }
        if (!(await this.reservations.lock(reservationId))) {
          throw NotFound("reservation.not_found", "Reservation not found.");
        }
        const r = (await this.reservations.findById(reservationId))!;
        return this.stageRefund(r, input, actorId);
      });
    } catch (err) {
      if (isUniqueViolation(err, "hotel_refunds_idempotency_uq")) {
        return readInTenant(() => this.repo.refundsForKey(input.idempotencyKey));
      }
      throw err;
    }
    return this.settleRefunds(
      staged.filter((f) => f.status === "pending").map((f) => f.id),
      actorId,
    ).then(() => readInTenant(() => this.repo.refundsForKey(input.idempotencyKey)));
  }

  /**
   * Inside the caller's transaction, with the reservation locked: validate a refund against the
   * credit and write the pending rows. Check-out uses this to return an overpayment as part of
   * the departure; `settleRefunds` must be called after the transaction commits.
   */
  async stageRefund(
    r: ReservationRecord,
    input: { amount: number; reason: string; idempotencyKey: string; paymentId?: string | null },
    actorId: string,
  ): Promise<RefundRecord[]> {
    const credit = await this.openCredit(r);
    if (toPiastres(input.amount) > toPiastres(credit)) {
      throw Conflict(
        "refund.exceeds_credit",
        credit > 0
          ? `Only ${formatEgp(credit)} is owed back to the guest.`
          : "Nothing is owed back to the guest — the folio isn't in credit.",
        { credit },
      );
    }
    const refundable = await this.refundablePayments(r.id);
    const pool = input.paymentId ? refundable.filter((p) => p.id === input.paymentId) : refundable;
    if (input.paymentId && pool.length === 0) {
      throw ValidationError("refund.unknown_payment", "That payment can't be refunded.");
    }
    const parts = allocateRefund(input.amount, pool);
    if (!parts) {
      throw Conflict(
        "refund.exceeds_payment",
        "That's more than is left to refund on the payment.",
      );
    }
    const methods = new Map(pool.map((p) => [p.id, p.method]));
    const rows: RefundRecord[] = [];
    for (const [i, part] of parts.entries()) {
      const id = await this.repo.insertPendingRefund({
        reservationId: r.id,
        paymentId: part.paymentId,
        method: methods.get(part.paymentId)!,
        amount: part.amount,
        reason: input.reason,
        provider: this.provider.name,
        idempotencyKey:
          parts.length === 1 ? input.idempotencyKey : `${input.idempotencyKey}#${i + 1}`,
        businessDate: await this.settings.today(),
        refundedBy: actorId,
      });
      rows.push((await this.repo.refundById(id))!);
    }
    return rows;
  }

  /** Call the provider for staged refunds (no transaction open) and record each answer. */
  async settleRefunds(refundIds: string[], actorId: string): Promise<void> {
    for (const id of refundIds) {
      const f = await readInTenant(() => this.repo.refundById(id));
      if (!f || f.status !== "pending") continue;
      const payment = await readInTenant(() => this.repo.paymentById(f.paymentId));
      const result = await this.provider.refund({
        reference: f.id,
        paymentReference: payment?.providerReference ?? null,
        amount: f.amount,
        currency: "EGP",
        method: f.method,
        reason: f.reason,
      });
      await this.uow.transaction(async () => {
        await this.repo.resolveRefund(f.id, { ...result, at: this.clock.now() });
        await this.audit.record({
          actorId,
          action: result.status === "completed" ? "hotel.refund.completed" : "hotel.refund.failed",
          resourceType: "hotel_refund",
          resourceId: f.id,
          after: {
            reservationId: f.reservationId,
            paymentId: f.paymentId,
            amount: f.amount,
            reason: f.reason,
            ...(result.failureReason && { failureReason: result.failureReason }),
          },
        });
        await this.events.publish(
          defineEvent(result.status === "completed" ? "refund.completed" : "refund.failed", 1, {
            refundId: f.id,
            reservationId: f.reservationId,
            amount: f.amount,
          }),
        );
      });
    }
  }

  /** What is owed back to the guest now: the folio's credit less refunds already in flight. */
  async openCredit(r: ReservationRecord): Promise<number> {
    const totals = await this.totals(r);
    const inFlight = (await this.repo.refunds(r.id))
      .filter((f) => f.status === "pending")
      .reduce((s, f) => s + toPiastres(f.amount), 0);
    return Math.max(0, -toPiastres(totals.balance) - inFlight) / 100;
  }

  /** Completed payments with what is still refundable on each, most recent first. */
  private async refundablePayments(reservationId: string) {
    const [payments, refunds] = await Promise.all([
      this.repo.payments(reservationId),
      this.repo.refunds(reservationId),
    ]);
    return payments
      .filter((p) => p.status === "completed")
      .map((p) => {
        const used = refunds
          .filter((f) => f.paymentId === p.id && f.status !== "failed")
          .reduce((s, f) => s + toPiastres(f.amount), 0);
        return { id: p.id, method: p.method, refundable: (toPiastres(p.amount) - used) / 100 };
      })
      .filter((p) => p.refundable > 0)
      .reverse();
  }

  private async requireRefunder(actorId: string): Promise<void> {
    const held = await this.rbac.permissionsForUser(actorId, requireOrganizationId());
    if (!held.some((k) => permissionMatches(k, "create", "refund"))) {
      throw Forbidden("refund.not_allowed", "Only finance staff or a manager can issue refunds.");
    }
  }

  /** Check-out's guard: may this user return an overpayment? */
  async canRefund(actorId: string): Promise<boolean> {
    const held = await this.rbac.permissionsForUser(actorId, requireOrganizationId());
    return held.some((k) => permissionMatches(k, "create", "refund"));
  }

  // ─── invoices: void + re-issue ────────────────────────────────────────────

  /** Void an issued invoice (with a reason) so the folio can be corrected and re-invoiced. */
  voidInvoice(id: string, reason: string, actorId: string) {
    return this.uow.transaction(async () => {
      await this.repo.lockInvoice(id);
      const inv = await this.repo.invoiceById(id);
      if (!inv) throw NotFound("invoice.not_found", "Invoice not found.");
      if (inv.status === "void")
        throw Conflict("invoice.already_void", "This invoice is already void.");
      await this.repo.voidInvoice(id, this.clock.now(), reason, actorId);
      await this.audit.record({
        actorId,
        action: "hotel.invoice.voided",
        resourceType: "hotel_invoice",
        resourceId: id,
        before: { number: inv.number, total: inv.total },
        after: { reason },
      });
      await this.events.publish(
        defineEvent("invoice.voided", 1, { invoiceId: id, reservationId: inv.reservationId }),
      );
      return { ok: true };
    });
  }

  /** Issue a fresh invoice for a checked-out stay whose invoice was voided and whose folio is square. */
  reissueInvoice(reservationId: string, actorId: string) {
    return this.uow.transaction(async () => {
      if (!(await this.reservations.lock(reservationId))) {
        throw NotFound("reservation.not_found", "Reservation not found.");
      }
      const r = (await this.reservations.findById(reservationId))!;
      if (r.status !== "checked_out") {
        throw Conflict("invoice.not_checked_out", "Invoices are issued when the guest checks out.");
      }
      if (await this.repo.issuedInvoiceFor(r.id)) {
        throw Conflict("invoice.already_issued", "This stay already has an issued invoice.");
      }
      const totals = await this.totals(r);
      if (totals.balance !== 0) {
        throw Conflict(
          "invoice.folio_open",
          totals.balance > 0
            ? `${formatEgp(totals.balance)} is still outstanding. Settle the folio first.`
            : `The guest is owed ${formatEgp(-totals.balance)}. Refund it first.`,
          { balance: totals.balance },
        );
      }
      return { invoiceId: await this.issueInvoice(r, actorId) };
    });
  }

  invoices(filter: { status?: "issued" | "void"; q?: string }) {
    return readInTenant(() => this.repo.listInvoices(filter));
  }

  // ─── lists: folio summaries, ledger, balances ─────────────────────────────

  /** Folio totals for many reservations in one query (list screens). */
  async summaries(
    rs: Array<{ id: string; status: string; total: number }>,
  ): Promise<Map<string, FolioTotals>> {
    const [aggregates, settings] = await Promise.all([
      this.repo.aggregates(rs.map((r) => r.id)),
      this.settings.operating(),
    ]);
    const out = new Map<string, FolioTotals>();
    for (const r of rs) {
      const a = aggregates.get(r.id);
      out.set(
        r.id,
        totalsFromSums({
          chargeCount: a?.chargeCount ?? 0,
          charges: a?.charges ?? 0,
          tax: a?.tax ?? 0,
          paid: a?.paid ?? 0,
          refunded: a?.refunded ?? 0,
          expected: { roomTotal: expectedRoomTotal(r.status, r.total), taxRate: settings.taxRate },
        }),
      );
    }
    return out;
  }

  /** `GET /hotel/folios?ids=` — payment state for the reservations list. */
  folioSummaries(ids: string[]) {
    return readInTenant(async () => {
      const rs = await this.reservations.findByIds(ids);
      const totals = await this.summaries(rs);
      return rs.map((r) => ({ reservationId: r.id, ...totals.get(r.id)! }));
    });
  }

  ledger(filter: LedgerFilter) {
    return readInTenant(async () => {
      const entries = await this.repo.ledger(filter);
      const names = await this.directory.userNames(entries.map((e) => e.actorId));
      return entries.map((e) => ({
        ...e,
        actorName: e.actorId ? (names.get(e.actorId) ?? null) : null,
      }));
    });
  }

  /** Every folio that isn't square: money still owed (due) and money owed back (credit). */
  balances() {
    return readInTenant(async () => {
      const candidates = await this.repo.balanceCandidates();
      const totals = await this.summaries(
        candidates.map((c) => ({ id: c.reservationId, status: c.status, total: c.bookedTotal })),
      );
      return candidates
        .map((c) => ({ ...c, ...totals.get(c.reservationId)! }))
        .filter((c) => c.balance !== 0)
        .map((c) => ({
          reservationId: c.reservationId,
          code: c.code,
          status: c.status,
          guestName: c.guestName,
          roomNumber: c.roomNumber,
          arrival: c.arrival,
          departure: c.departure,
          total: c.total,
          paid: c.paid,
          balance: c.balance,
          kind: c.balance > 0 ? ("due" as const) : ("credit" as const),
        }));
    });
  }

  /** Payments page summary cards. Dates are the hotel's. */
  financeSummary() {
    return readInTenant(async () => {
      const today = await this.settings.today();
      const monthStart = `${today.slice(0, 8)}01`;
      const [day, month, balances] = await Promise.all([
        this.repo.flows(today, addDays(today, 1)),
        this.repo.flows(monthStart, addDays(today, 1)),
        this.balances(),
      ]);
      const sum = (xs: number[]) => xs.reduce((s, x) => s + toPiastres(x), 0) / 100;
      return {
        date: today,
        today: { collected: day.collected, refunded: day.refunded },
        month: {
          collected: month.collected,
          refunded: month.refunded,
          net: sum([month.collected, -month.refunded]),
        },
        pendingCount: day.pendingCount,
        outstanding: sum(balances.filter((b) => b.kind === "due").map((b) => b.balance)),
        credits: sum(balances.filter((b) => b.kind === "credit").map((b) => -b.balance)),
        openFolios: balances.length,
      };
    });
  }
}
