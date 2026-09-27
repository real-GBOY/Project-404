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
  items: Array<{
    description: string;
    serviceDate: IsoDate;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxAmount: number;
  }>;
}

export interface FolioAggregate {
  chargeCount: number;
  charges: number;
  tax: number;
  paid: number;
  pending: number;
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
               WHERE p.organization_id = r.organization_id AND p.reservation_id = r.id AND p.status = 'pending'), 0)::text AS pending
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
      });
    }
    return map;
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
      receivedBy: r.received_by,
      createdAt: r.created_at,
      completedAt: r.completed_at,
    };
  }
}
