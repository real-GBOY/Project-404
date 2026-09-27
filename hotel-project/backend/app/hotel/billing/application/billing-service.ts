import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, EVENT_BUS, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IEventBus } from "@core/contracts/index.js";
import { defineEvent } from "@core/contracts/index.js";
import { UserDirectory } from "@core/identity/application/user-directory.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import {
  ReservationsRepository,
  type ReservationRecord,
} from "@hotel/hotel/reservations/infrastructure/reservations-repository.js";
import { formatStayNight } from "@hotel/hotel/shared/labels.js";
import { toPiastres } from "@hotel/hotel/shared/money.js";
import type { IsoDate } from "@hotel/hotel/shared/dates.js";
import { isUniqueViolation } from "@hotel/hotel/shared/pg-errors.js";
import { folioTotals, splitRoomCharges, taxFor, type FolioTotals } from "../domain/folio.js";
import {
  PAYMENT_PROVIDER,
  type PaymentMethod,
  type PaymentProvider,
} from "../domain/payment-provider.js";
import {
  BillingRepository,
  type ChargeKind,
  type PaymentRecord,
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
      const [charges, payments, totals, invoiceId] = await Promise.all([
        this.repo.charges(reservationId),
        this.repo.payments(reservationId),
        this.totals(r),
        this.repo.issuedInvoiceFor(reservationId),
      ]);
      const names = await this.directory.userNames(payments.map((p) => p.receivedBy));
      return {
        reservationId,
        totals,
        invoiceId,
        charges,
        payments: payments.map((p) => ({
          ...p,
          receivedByName: p.receivedBy ? (names.get(p.receivedBy) ?? null) : null,
        })),
      };
    });
  }

  /** Ledger totals for a reservation (inside a tenant transaction). */
  async totals(r: ReservationRecord): Promise<FolioTotals> {
    const [charges, payments, settings] = await Promise.all([
      this.repo.charges(r.id),
      this.repo.payments(r.id),
      this.settings.current(),
    ]);
    return folioTotals({
      charges: charges.map((c) => ({
        amount: c.amount,
        taxAmount: c.taxAmount,
        voided: c.voidedAt !== null,
      })),
      completedPayments: payments.filter((p) => p.status === "completed").map((p) => p.amount),
      refunds: [],
      expected: { roomTotal: r.total, taxRate: settings.taxRate },
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
      const settings = await this.settings.current();
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
    const settings = await this.settings.current();
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
    const settings = await this.settings.current();
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
            `That's more than the outstanding balance of ${(open / 100).toFixed(2)} EGP.`,
            { balance: open / 100 },
          );
        }
        const id = await this.repo.insertPendingPayment({
          reservationId,
          method: input.method,
          amount: input.amount,
          provider: this.provider.name,
          idempotencyKey: input.idempotencyKey,
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
        description: `Hotel Nayel · ${staged.code}`,
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
}
