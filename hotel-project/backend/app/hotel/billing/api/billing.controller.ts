import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { ValidationError } from "@core/kernel/errors.js";
import { createPrefixedId } from "@core/kernel/id.js";
import { BillingService } from "../application/billing-service.js";
import {
  folioSummariesQuery,
  invoicesQuery,
  ledgerQuery,
  refundSchema,
  voidInvoiceSchema,
  type FolioSummariesQuery,
  type InvoicesQuery,
  type LedgerQuery,
  type RefundBody,
  type VoidInvoiceBody,
  collectPaymentSchema,
  postChargeSchema,
  voidChargeSchema,
  type CollectPaymentBody,
  type PostChargeBody,
  type VoidChargeBody,
} from "../validation/billing.schema.js";

const KEY = /^[A-Za-z0-9_-]{8,100}$/;

/** A client `Idempotency-Key`, validated; undefined when the client sent none. */
function checkedKey(key: string | undefined): string | undefined {
  if (key !== undefined && !KEY.test(key)) {
    throw ValidationError(
      "payment.bad_idempotency_key",
      "Idempotency-Key must be 8–100 letters, digits, - or _.",
    );
  }
  return key;
}

@ApiTags("hotel · billing")
@ApiBearerAuth("access-token")
@Controller("hotel")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get("reservations/:id/folio")
  @RequirePermission("read", "folio")
  folio(@Param("id") id: string) {
    return this.billing.folio(id);
  }

  @Post("reservations/:id/charges")
  @HttpCode(201)
  @RequirePermission("post", "charge")
  postCharge(
    @Param("id") id: string,
    @Body(ZodBody(postChargeSchema)) body: PostChargeBody,
    @CurrentUser() user: Principal,
  ) {
    return this.billing.postCharge(id, body, user.userId);
  }

  @Post("charges/:id/void")
  @HttpCode(200)
  @RequirePermission("void", "charge")
  voidCharge(
    @Param("id") id: string,
    @Body(ZodBody(voidChargeSchema)) body: VoidChargeBody,
    @CurrentUser() user: Principal,
  ) {
    return this.billing.voidCharge(id, body.reason, user.userId);
  }

  /**
   * Clients send an `Idempotency-Key` (the app generates one per payment attempt) so a retried
   * request never charges twice. Without one the server generates a key — safe, just not
   * retry-proof.
   */
  @Post("reservations/:id/payments")
  @HttpCode(201)
  @RequirePermission("create", "payment")
  collect(
    @Param("id") id: string,
    @Body(ZodBody(collectPaymentSchema)) body: CollectPaymentBody,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentUser() user: Principal,
  ) {
    return this.billing.collectPayment(
      id,
      { ...body, idempotencyKey: checkedKey(key) ?? createPrefixedId("idem") },
      user.userId,
    );
  }

  @Post("reservations/:id/refunds")
  @HttpCode(201)
  @RequirePermission("create", "refund")
  async refund(
    @Param("id") id: string,
    @Body(ZodBody(refundSchema)) body: RefundBody,
    @Headers("idempotency-key") key: string | undefined,
    @CurrentUser() user: Principal,
  ) {
    return {
      items: await this.billing.refund(
        id,
        { ...body, idempotencyKey: checkedKey(key) ?? createPrefixedId("idem") },
        user.userId,
      ),
    };
  }

  @Get("folios")
  @RequirePermission("read", "folio")
  async folios(@Query(ZodQuery(folioSummariesQuery)) q: FolioSummariesQuery) {
    return { items: await this.billing.folioSummaries(q.ids) };
  }

  @Get("invoices")
  @RequirePermission("read", "invoice")
  async invoices(@Query(ZodQuery(invoicesQuery)) q: InvoicesQuery) {
    return { items: await this.billing.invoices(q) };
  }

  @Get("invoices/:id")
  @RequirePermission("read", "invoice")
  invoice(@Param("id") id: string) {
    return this.billing.invoice(id);
  }

  @Post("invoices/:id/void")
  @HttpCode(200)
  @RequirePermission("void", "invoice")
  voidInvoice(
    @Param("id") id: string,
    @Body(ZodBody(voidInvoiceSchema)) body: VoidInvoiceBody,
    @CurrentUser() user: Principal,
  ) {
    return this.billing.voidInvoice(id, body.reason, user.userId);
  }

  @Post("reservations/:id/invoice")
  @HttpCode(201)
  @RequirePermission("issue", "invoice")
  reissue(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.billing.reissueInvoice(id, user.userId);
  }

  @Get("payments")
  @RequirePermission("read", "payment")
  async ledger(@Query(ZodQuery(ledgerQuery)) q: LedgerQuery) {
    return { items: await this.billing.ledger(q) };
  }

  @Get("finance/summary")
  @RequirePermission("read", "payment")
  summary() {
    return this.billing.financeSummary();
  }

  @Get("finance/balances")
  @RequirePermission("read", "payment")
  async balances() {
    return { items: await this.billing.balances() };
  }
}
