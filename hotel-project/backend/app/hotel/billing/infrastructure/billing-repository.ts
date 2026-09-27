import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { hotelDb } from "@hotel/hotel/db/executor.js";
import { hotelId } from "@hotel/hotel/shared/ids.js";
import type { IsoDate } from "@hotel/hotel/shared/dates.js";
import { moneyNumber, moneyString } from "@hotel/hotel/shared/money.js";
import type { PaymentMethod } from "../domain/payment-provider.js";

export type ChargeKind =
  "room" | "breakfast" | "extra_bed" | "minibar" | "laundry" | "transfer" | "service";

export interface ChargeRecord {
  id: string;
  reservationId: string;
  kind: ChargeKind;
  description: string;
  serviceDate: IsoDate;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxAmount: number;
  invoiceId: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
  createdAt: Date;
}

export interface PaymentRecord {
  id: string;
  reservationId: string;
  invoiceId: string | null;
  method: PaymentMethod;
  amount: number;
  status: "pending" | "completed" | "failed";
  provider: string;
  providerReference: string | null;
  failureReason: string | null;
  idempotencyKey: string;
  /** The hotel date the money was taken on (daily takings are reported by it). */
  businessDate: IsoDate;
  receivedBy: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface InvoiceRecord {
  id: string;
  number: string;
  reservationId: string;
  status: "issued" | "void";
  subtotal: number;
  tax: number;
  total: number;
  taxRate: number;
  billToName: string;
  issuedBy: string | null;
  issuedAt: Date;
  voidedAt: Date | null;
  voidReason: string | null;
  voidedBy: string | null;
  items: Array<{
    description: string;
    serviceDate: IsoDate;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxAmount: number;
  }>;
}

export interface RefundRecord {
  id: string;
  reservationId: string;
  paymentId: string;
  method: PaymentMethod;
  amount: number;
  reason: string;
  status: "pending" | "completed" | "failed";
  provider: string;
  providerReference: string | null;
  failureReason: string | null;
  idempotencyKey: string;
  businessDate: IsoDate;
  refundedBy: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

/** One row of the finance ledger: a payment in, or a refund out. */
export interface LedgerEntry {
  id: string;
  kind: "payment" | "refund";
  reservationId: string;
  reservationCode: string;
  guestName: string;
  method: PaymentMethod;
  amount: number;
  status: "pending" | "completed" | "failed";
  actorId: string | null;
  businessDate: IsoDate;
  createdAt: Date;
}

export interface LedgerFilter {
  kind?: "payment" | "refund";
  method?: PaymentMethod;
  status?: "pending" | "completed" | "failed";
  from?: IsoDate;
  to?: IsoDate;
  q?: string;
}

export interface InvoiceListItem {
  id: string;
  number: string;
  reservationId: string;
  reservationCode: string;
  billToName: string;
  total: number;
  status: "issued" | "void";
  issuedAt: Date;
}

export interface BalanceRow {
  reservationId: string;
  code: string;
  status: string;
  guestName: string;
  roomNumber: string | null;
  arrival: IsoDate;
  departure: IsoDate;
  bookedTotal: number;
}

export interface FolioAggregate {
  chargeCount: number;
  charges: number;
  tax: number;
  paid: number;
  pending: number;
  refunded: number;
}

@Injectable()
export class BillingRepository {
  private org() {
    return requireOrganizationId();
  }

  // ─── charges ──────────────────────────────────────────────────────────────

  async insertCharge(c: {
    reservationId: string;
    kind: ChargeKind;
    description: string;
    serviceDate: IsoDate;
    quantity: number;
    unitPrice: number;
    taxAmount: number;
    createdBy: string | null;
  }): Promise<string> {
    const id = hotelId("fch");
    await hotelDb()
      .insertInto("hotel_folio_charges")
      .values({
        id,
        organization_id: this.org(),
        reservation_id: c.reservationId,
        kind: c.kind,
        description: c.description,
        service_date: c.serviceDate,
        quantity: c.quantity,
        unit_price: moneyString(c.unitPrice),
        amount: moneyString(c.unitPrice * c.quantity),
        tax_amount: moneyString(c.taxAmount),
        created_by: c.createdBy,
      })
      .execute();
    return id;
  }

  async charges(reservationId: string): Promise<ChargeRecord[]> {
    const rows = await hotelDb()
      .selectFrom("hotel_folio_charges")
      .select([
        "id",
        "reservation_id",
        "kind",
        "description",
        sql<string>`service_date::text`.as("service_date"),
        "quantity",
        "unit_price",
        "amount",
        "tax_amount",
        "invoice_id",
        "voided_at",
        "void_reason",
        "created_at",
      ])
      .where("organization_id", "=", this.org())
      .where("reservation_id", "=", reservationId)
      .orderBy("service_date")
      .orderBy("created_at")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      reservationId: r.reservation_id,
      kind: r.kind,
      description: r.description,
      serviceDate: r.service_date,
      quantity: r.quantity,
      unitPrice: moneyNumber(r.unit_price),
      amount: moneyNumber(r.amount),
      taxAmount: moneyNumber(r.tax_amount),
      invoiceId: r.invoice_id,
      voidedAt: r.voided_at,
      voidReason: r.void_reason,
      createdAt: r.created_at,
    }));
  }

  async findCharge(id: string): Promise<ChargeRecord | null> {
    const row = await hotelDb()
      .selectFrom("hotel_folio_charges")
      .select("reservation_id")
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return null;
    return (await this.charges(row.reservation_id)).find((c) => c.id === id) ?? null;
  }

  async voidCharge(id: string, at: Date, reason: string): Promise<void> {
    await hotelDb()
      .updateTable("hotel_folio_charges")
      .set({ voided_at: at, void_reason: reason })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .where("voided_at", "is", null)
      .execute();
  }

  // ─── payments ─────────────────────────────────────────────────────────────

  async insertPendingPayment(p: {
    reservationId: string;
    method: PaymentMethod;
    amount: number;
    provider: string;
    idempotencyKey: string;
    businessDate: IsoDate;
    receivedBy: string | null;
  }): Promise<string> {
    const id = hotelId("pay");
    await hotelDb()
      .insertInto("hotel_payments")
      .values({
        id,
        organization_id: this.org(),
        reservation_id: p.reservationId,
        method: p.method,
        amount: moneyString(p.amount),
        status: "pending",
        provider: p.provider,
        idempotency_key: p.idempotencyKey,
        business_date: p.businessDate,
        received_by: p.receivedBy,
      })
      .execute();
    return id;
  }

  async resolvePayment(
    id: string,
    r: {
      status: "completed" | "failed";
      providerReference: string | null;
      failureReason: string | null;
      at: Date;
    },
  ): Promise<void> {
    await hotelDb()
      .updateTable("hotel_payments")
      .set({
        status: r.status,
        provider_reference: r.providerReference,
        failure_reason: r.failureReason,
        completed_at: r.status === "completed" ? r.at : null,
      })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .where("status", "=", "pending")
      .execute();
  }

  private paymentQuery() {
    return hotelDb()
      .selectFrom("hotel_payments")
      .selectAll()
      .select(sql<string>`business_date::text`.as("business_day"))
      .where("organization_id", "=", this.org());
  }

  async payments(reservationId: string): Promise<PaymentRecord[]> {
    const rows = await this.paymentQuery()
      .where("reservation_id", "=", reservationId)
      .orderBy("created_at")
      .execute();
    return rows.map((r) => this.toPayment(r));
  }

  async paymentById(id: string): Promise<PaymentRecord | null> {
    const row = await this.paymentQuery().where("id", "=", id).executeTakeFirst();
    return row ? this.toPayment(row) : null;
  }

  async paymentByKey(key: string): Promise<PaymentRecord | null> {
    const row = await this.paymentQuery().where("idempotency_key", "=", key).executeTakeFirst();
    return row ? this.toPayment(row) : null;
  }

  // ─── invoices ─────────────────────────────────────────────────────────────

  async nextInvoiceNumber(): Promise<string> {
    const row = await hotelDb()
      .insertInto("hotel_counters")
      .values({ organization_id: this.org(), name: "invoice", value: "1001" })
      .onConflict((oc) =>
        oc
          .columns(["organization_id", "name"])
          .doUpdateSet({ value: sql`hotel_counters.value + 1` }),
      )
      .returning("value")
      .executeTakeFirstOrThrow();
    return `INV-${row.value}`;
  }

  /** Freeze the given charges onto a new invoice and link charges + completed payments to it. */
  async issueInvoice(i: {
    number: string;
    reservationId: string;
    billToName: string;
    taxRate: number;
    charges: ChargeRecord[];
    subtotal: number;
    tax: number;
    issuedBy: string | null;
  }): Promise<string> {
    const id = hotelId("inv");
    const org = this.org();
    await hotelDb()
      .insertInto("hotel_invoices")
      .values({
        id,
        organization_id: org,
        number: i.number,
        reservation_id: i.reservationId,
        subtotal: moneyString(i.subtotal),
        tax: moneyString(i.tax),
        total: moneyString(i.subtotal + i.tax),
        tax_rate: i.taxRate.toFixed(4),
        bill_to_name: i.billToName,
        issued_by: i.issuedBy,
      })
      .execute();
    if (i.charges.length > 0) {
      await hotelDb()
        .insertInto("hotel_invoice_items")
        .values(
          i.charges.map((c, position) => ({
            id: hotelId("ivi"),
            organization_id: org,
            invoice_id: id,
            charge_id: c.id,
            description: c.description,
            service_date: c.serviceDate,
            quantity: c.quantity,
            unit_price: moneyString(c.unitPrice),
            amount: moneyString(c.amount),
            tax_amount: moneyString(c.taxAmount),
            position,
          })),
        )
        .execute();
      await hotelDb()
        .updateTable("hotel_folio_charges")
        .set({ invoice_id: id })
        .where("organization_id", "=", org)
        .where(
          "id",
          "in",
          i.charges.map((c) => c.id),
        )
        .execute();
    }
    await hotelDb()
      .updateTable("hotel_payments")
      .set({ invoice_id: id })
      .where("organization_id", "=", org)
      .where("reservation_id", "=", i.reservationId)
      .where("status", "=", "completed")
      .where("invoice_id", "is", null)
      .execute();
    return id;
  }

  async invoiceById(id: string): Promise<InvoiceRecord | null> {
    const inv = await hotelDb()
      .selectFrom("hotel_invoices")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    if (!inv) return null;
    const items = await hotelDb()
      .selectFrom("hotel_invoice_items")
      .select([
        "description",
        sql<string>`service_date::text`.as("service_date"),
        "quantity",
        "unit_price",
        "amount",
        "tax_amount",
      ])
      .where("organization_id", "=", this.org())
      .where("invoice_id", "=", id)
      .orderBy("position")
      .execute();
    return {
      id: inv.id,
      number: inv.number,
      reservationId: inv.reservation_id,
      status: inv.status,
      subtotal: moneyNumber(inv.subtotal),
      tax: moneyNumber(inv.tax),
      total: moneyNumber(inv.total),
      taxRate: Number(inv.tax_rate),
      billToName: inv.bill_to_name,
      issuedBy: inv.issued_by,
      issuedAt: inv.issued_at,
      voidedAt: inv.voided_at,
      voidReason: inv.void_reason,
      voidedBy: inv.voided_by,
      items: items.map((it) => ({
        description: it.description,
        serviceDate: it.service_date,
        quantity: it.quantity,
        unitPrice: moneyNumber(it.unit_price),
        amount: moneyNumber(it.amount),
        taxAmount: moneyNumber(it.tax_amount),
      })),
    };
  }

  async issuedInvoiceFor(reservationId: string): Promise<string | null> {
    const row = await hotelDb()
      .selectFrom("hotel_invoices")
      .select("id")
      .where("organization_id", "=", this.org())
      .where("reservation_id", "=", reservationId)
      .where("status", "=", "issued")
      .executeTakeFirst();
    return row?.id ?? null;
  }

  /** Folio sums for many reservations at once (front-desk and list screens; no N+1). */
  async aggregates(reservationIds: string[]): Promise<Map<string, FolioAggregate>> {
    const map = new Map<string, FolioAggregate>();
    if (reservationIds.length === 0) return map;
    const org = this.org();
    const rows = await sql<{
      reservation_id: string;
      charge_count: number;
      charges: string;
      tax: string;
      paid: string;
      pending: string;
      refunded: string;
    }>`
      SELECT r.id AS reservation_id,
             (SELECT count(*)::int FROM hotel_folio_charges c
               WHERE c.organization_id = r.organization_id AND c.reservation_id = r.id AND c.voided_at IS NULL) AS charge_count,
             COALESCE((SELECT sum(c.amount) FROM hotel_folio_charges c
               WHERE c.organization_id = r.organization_id AND c.reservation_id = r.id AND c.voided_at IS NULL), 0)::text AS charges,
             COALESCE((SELECT sum(c.tax_amount) FROM hotel_folio_charges c
               WHERE c.organization_id = r.organization_id AND c.reservation_id = r.id AND c.voided_at IS NULL), 0)::text AS tax,
             COALESCE((SELECT sum(p.amount) FROM hotel_payments p
               WHERE p.organization_id = r.organization_id AND p.reservation_id = r.id AND p.status = 'completed'), 0)::text AS paid,
             COALESCE((SELECT sum(p.amount) FROM hotel_payments p
               WHERE p.organization_id = r.organization_id AND p.reservation_id = r.id AND p.status = 'pending'), 0)::text AS pending,
             COALESCE((SELECT sum(f.amount) FROM hotel_refunds f
               WHERE f.organization_id = r.organization_id AND f.reservation_id = r.id AND f.status = 'completed'), 0)::text AS refunded
        FROM hotel_reservations r
       WHERE r.organization_id = ${org}
         AND r.id IN (${sql.join(reservationIds)})
    `.execute(hotelDb());
    for (const r of rows.rows) {
      map.set(r.reservation_id, {
        chargeCount: r.charge_count,
        charges: moneyNumber(r.charges),
        tax: moneyNumber(r.tax),
        paid: moneyNumber(r.paid),
        pending: moneyNumber(r.pending),
        refunded: moneyNumber(r.refunded),
      });
    }
    return map;
  }

  // ─── refunds ──────────────────────────────────────────────────────────────

  async insertPendingRefund(f: {
    reservationId: string;
    paymentId: string;
    method: PaymentMethod;
    amount: number;
    reason: string;
    provider: string;
    idempotencyKey: string;
    businessDate: IsoDate;
    refundedBy: string | null;
  }): Promise<string> {
    const id = hotelId("rfd");
    await hotelDb()
      .insertInto("hotel_refunds")
      .values({
        id,
        organization_id: this.org(),
        reservation_id: f.reservationId,
        payment_id: f.paymentId,
        method: f.method,
        amount: moneyString(f.amount),
        reason: f.reason,
        status: "pending",
        provider: f.provider,
        idempotency_key: f.idempotencyKey,
        business_date: f.businessDate,
        refunded_by: f.refundedBy,
      })
      .execute();
    return id;
  }

  async resolveRefund(
    id: string,
    r: {
      status: "completed" | "failed";
      providerReference: string | null;
      failureReason: string | null;
      at: Date;
    },
  ): Promise<void> {
    await hotelDb()
      .updateTable("hotel_refunds")
      .set({
        status: r.status,
        provider_reference: r.providerReference,
        failure_reason: r.failureReason,
        completed_at: r.status === "completed" ? r.at : null,
      })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .where("status", "=", "pending")
      .execute();
  }

  private refundQuery() {
    return hotelDb()
      .selectFrom("hotel_refunds")
      .selectAll()
      .select(sql<string>`business_date::text`.as("business_day"))
      .where("organization_id", "=", this.org());
  }

  async refunds(reservationId: string): Promise<RefundRecord[]> {
    const rows = await this.refundQuery()
      .where("reservation_id", "=", reservationId)
      .orderBy("created_at")
      .orderBy("idempotency_key")
      .execute();
    return rows.map((r) => this.toRefund(r));
  }

  async refundById(id: string): Promise<RefundRecord | null> {
    const row = await this.refundQuery().where("id", "=", id).executeTakeFirst();
    return row ? this.toRefund(row) : null;
  }

  /** The refund rows written for one request: its key, or `key#n` when it was split. */
  async refundsForKey(key: string): Promise<RefundRecord[]> {
    const rows = await this.refundQuery()
      .where((eb) =>
        eb.or([eb("idempotency_key", "=", key), eb("idempotency_key", "like", `${key}#%`)]),
      )
      .orderBy("idempotency_key")
      .execute();
    return rows.map((r) => this.toRefund(r));
  }

  // ─── invoices: list + void ────────────────────────────────────────────────

  async listInvoices(filter: {
    status?: "issued" | "void";
    q?: string;
  }): Promise<InvoiceListItem[]> {
    let q = hotelDb()
      .selectFrom("hotel_invoices as i")
      .innerJoin("hotel_reservations as r", (j) =>
        j
          .onRef("r.id", "=", "i.reservation_id")
          .onRef("r.organization_id", "=", "i.organization_id"),
      )
      .select([
        "i.id",
        "i.number",
        "i.reservation_id",
        "r.code as reservation_code",
        "i.bill_to_name",
        "i.total",
        "i.status",
        "i.issued_at",
      ])
      .where("i.organization_id", "=", this.org());
    if (filter.status) q = q.where("i.status", "=", filter.status);
    if (filter.q) {
      const like = `%${filter.q}%`;
      q = q.where((eb) =>
        eb.or([
          eb("i.number", "ilike", like),
          eb("i.bill_to_name", "ilike", like),
          eb("r.code", "ilike", like),
        ]),
      );
    }
    const rows = await q
      .orderBy("i.issued_at", "desc")
      .orderBy("i.number", "desc")
      .limit(500)
      .execute();
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      reservationId: r.reservation_id,
      reservationCode: r.reservation_code,
      billToName: r.bill_to_name,
      total: moneyNumber(r.total),
      status: r.status,
      issuedAt: r.issued_at,
    }));
  }

  async lockInvoice(id: string): Promise<void> {
    await hotelDb()
      .selectFrom("hotel_invoices")
      .select("id")
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .forUpdate()
      .execute();
  }

  /**
   * Void an invoice. Its frozen items stay as the record of what was issued; the charges and
   * payments are released from it so the folio can be corrected and a new invoice issued.
   */
  async voidInvoice(id: string, at: Date, reason: string, by: string): Promise<void> {
    const org = this.org();
    await hotelDb()
      .updateTable("hotel_invoices")
      .set({ status: "void", voided_at: at, void_reason: reason, voided_by: by })
      .where("organization_id", "=", org)
      .where("id", "=", id)
      .where("status", "=", "issued")
      .execute();
    await hotelDb()
      .updateTable("hotel_folio_charges")
      .set({ invoice_id: null })
      .where("organization_id", "=", org)
      .where("invoice_id", "=", id)
      .execute();
    await hotelDb()
      .updateTable("hotel_payments")
      .set({ invoice_id: null })
      .where("organization_id", "=", org)
      .where("invoice_id", "=", id)
      .execute();
  }

  async invoicesFor(reservationId: string) {
    const rows = await hotelDb()
      .selectFrom("hotel_invoices")
      .select(["id", "number", "status", "total", "issued_at"])
      .where("organization_id", "=", this.org())
      .where("reservation_id", "=", reservationId)
      .orderBy("issued_at")
      .execute();
    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      total: moneyNumber(r.total),
      issuedAt: r.issued_at,
    }));
  }

  // ─── ledger + balances ────────────────────────────────────────────────────

  /** Payments in and refunds out, newest first, with the booking and guest they belong to. */
  async ledger(filter: LedgerFilter): Promise<LedgerEntry[]> {
    const org = this.org();
    const conds = [sql`e.organization_id = ${org}`];
    if (filter.kind) conds.push(sql`e.kind = ${filter.kind}`);
    if (filter.method) conds.push(sql`e.method = ${filter.method}`);
    if (filter.status) conds.push(sql`e.status = ${filter.status}`);
    if (filter.from) conds.push(sql`e.business_date >= ${filter.from}::date`);
    if (filter.to) conds.push(sql`e.business_date < ${filter.to}::date`);
    if (filter.q) {
      const like = `%${filter.q}%`;
      conds.push(sql`(r.code ILIKE ${like} OR g.full_name ILIKE ${like} OR e.id ILIKE ${like})`);
    }
    const rows = await sql<{
      id: string;
      kind: "payment" | "refund";
      reservation_id: string;
      code: string;
      guest_name: string;
      method: PaymentMethod;
      amount: string;
      status: "pending" | "completed" | "failed";
      actor_id: string | null;
      business_date: string;
      created_at: Date;
    }>`
      SELECT e.id, e.kind, e.reservation_id, r.code, g.full_name AS guest_name, e.method,
             e.amount::text AS amount, e.status, e.actor_id,
             e.business_date::text AS business_date, e.created_at
        FROM (
          SELECT id, organization_id, 'payment' AS kind, reservation_id, method, amount, status,
                 received_by AS actor_id, business_date, created_at
            FROM hotel_payments
          UNION ALL
          SELECT id, organization_id, 'refund' AS kind, reservation_id, method, amount, status,
                 refunded_by AS actor_id, business_date, created_at
            FROM hotel_refunds
        ) e
        JOIN hotel_reservations r ON r.organization_id = e.organization_id AND r.id = e.reservation_id
        JOIN hotel_guests g ON g.organization_id = r.organization_id AND g.id = r.guest_id
       WHERE ${sql.join(conds, sql` AND `)}
       ORDER BY e.business_date DESC, e.created_at DESC, e.id DESC
       LIMIT 500
    `.execute(hotelDb());
    return rows.rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      reservationId: r.reservation_id,
      reservationCode: r.code,
      guestName: r.guest_name,
      method: r.method,
      amount: moneyNumber(r.amount),
      status: r.status,
      actorId: r.actor_id,
      businessDate: r.business_date,
      createdAt: r.created_at,
    }));
  }

  /** Money in and out between two hotel business dates (half-open). */
  async flows(from: IsoDate, to: IsoDate) {
    const org = this.org();
    const rows = await sql<{ collected: string; refunded: string; pending: string }>`
      SELECT
        COALESCE((SELECT sum(amount) FROM hotel_payments
                   WHERE organization_id = ${org} AND status = 'completed'
                     AND business_date >= ${from}::date AND business_date < ${to}::date), 0)::text AS collected,
        COALESCE((SELECT sum(amount) FROM hotel_refunds
                   WHERE organization_id = ${org} AND status = 'completed'
                     AND business_date >= ${from}::date AND business_date < ${to}::date), 0)::text AS refunded,
        ((SELECT count(*) FROM hotel_payments WHERE organization_id = ${org} AND status = 'pending')
          + (SELECT count(*) FROM hotel_refunds WHERE organization_id = ${org} AND status = 'pending'))::text
          AS pending
    `.execute(hotelDb());
    const r = rows.rows[0]!;
    return {
      collected: moneyNumber(r.collected),
      refunded: moneyNumber(r.refunded),
      pendingCount: Number(r.pending),
    };
  }

  /**
   * Bookings whose folio may not be square: in house, checked out, or cancelled / no-show with
   * money on them. The service computes each balance from the ledger and keeps the non-zero ones.
   */
  async balanceCandidates(): Promise<BalanceRow[]> {
    const org = this.org();
    const rows = await sql<{
      id: string;
      code: string;
      status: string;
      guest_name: string;
      room_number: string | null;
      arrival: string;
      departure: string;
      total: string;
    }>`
      SELECT r.id, r.code, r.status, g.full_name AS guest_name, rm.number AS room_number,
             r.arrival::text AS arrival, r.departure::text AS departure, r.total::text AS total
        FROM hotel_reservations r
        JOIN hotel_guests g ON g.organization_id = r.organization_id AND g.id = r.guest_id
        LEFT JOIN hotel_room_allocations a
          ON a.organization_id = r.organization_id AND a.reservation_id = r.id AND a.kind = 'reservation'
        LEFT JOIN hotel_rooms rm ON rm.organization_id = a.organization_id AND rm.id = a.room_id
       WHERE r.organization_id = ${org}
         AND (r.status IN ('checked_in', 'checked_out')
              OR (r.status IN ('cancelled', 'no_show') AND EXISTS (
                    SELECT 1 FROM hotel_payments p
                     WHERE p.organization_id = r.organization_id AND p.reservation_id = r.id
                       AND p.status = 'completed')))
       ORDER BY r.departure, r.code
    `.execute(hotelDb());
    return rows.rows.map((r) => ({
      reservationId: r.id,
      code: r.code,
      status: r.status,
      guestName: r.guest_name,
      roomNumber: r.room_number,
      arrival: r.arrival,
      departure: r.departure,
      bookedTotal: moneyNumber(r.total),
    }));
  }

  private toRefund(r: {
    id: string;
    reservation_id: string;
    payment_id: string;
    method: PaymentMethod;
    amount: string;
    reason: string;
    status: "pending" | "completed" | "failed";
    provider: string;
    provider_reference: string | null;
    failure_reason: string | null;
    idempotency_key: string;
    business_day: string;
    refunded_by: string | null;
    created_at: Date;
    completed_at: Date | null;
  }): RefundRecord {
    return {
      id: r.id,
      reservationId: r.reservation_id,
      paymentId: r.payment_id,
      method: r.method,
      amount: moneyNumber(r.amount),
      reason: r.reason,
      status: r.status,
      provider: r.provider,
      providerReference: r.provider_reference,
      failureReason: r.failure_reason,
      idempotencyKey: r.idempotency_key,
      businessDate: r.business_day,
      refundedBy: r.refunded_by,
      createdAt: r.created_at,
      completedAt: r.completed_at,
    };
  }

  private toPayment(r: {
    id: string;
    reservation_id: string;
    invoice_id: string | null;
    method: PaymentMethod;
    amount: string;
    status: "pending" | "completed" | "failed";
    provider: string;
    provider_reference: string | null;
    failure_reason: string | null;
    idempotency_key: string;
    business_day: string;
    received_by: string | null;
    created_at: Date;
    completed_at: Date | null;
  }): PaymentRecord {
    return {
      id: r.id,
      reservationId: r.reservation_id,
      invoiceId: r.invoice_id,
      method: r.method,
      amount: moneyNumber(r.amount),
      status: r.status,
      provider: r.provider,
      providerReference: r.provider_reference,
      failureReason: r.failure_reason,
      idempotencyKey: r.idempotency_key,
      businessDate: r.business_day,
      receivedBy: r.received_by,
      createdAt: r.created_at,
      completedAt: r.completed_at,
    };
  }
}
