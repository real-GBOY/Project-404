import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { CurrentUser, RequirePermission } from "../../../../../core/http/decorators.js";
import { JwtAuthGuard } from "../../../../../core/http/jwt-auth.guard.js";
import { PermissionGuard } from "../../../../../core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "../../../../../core/http/zod.pipe.js";
import type { Principal } from "../../../../../core/http/principal.js";
import { BillingService } from "./billing-service.js";

const currency = z.enum(["EGP", "AED", "USD", "SAR"]);
const line = z.object({
  kind: z.enum(["fee", "disbursement"]),
  description: z.string().trim().min(1).max(300),
  amount: z.number().min(0),
});
const createInvoice = z.object({
  clientId: z.string().min(1),
  matterId: z.string().nullish(),
  currency: currency.optional(),
  vatRate: z.number().min(0).max(1).optional(),
  lines: z.array(line).max(100).optional(),
});
const updateInvoice = z.object({
  lines: z.array(line).max(100).optional(),
  vatRate: z.number().min(0).max(1).optional(),
  dueAt: z.string().nullish(),
});
const recordPayment = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().min(1),
  method: z.enum(["bank_transfer", "cheque", "cash", "card"]),
  receivedAt: z.string().optional(),
  reference: z.string().trim().max(120).optional(),
});
const recordExpense = z.object({
  description: z.string().trim().min(1).max(400),
  category: z.string().trim().max(80).optional(),
  amount: z.number().positive(),
  currency: z.string().optional(),
  matterId: z.string().nullish(),
  incurredAt: z.string().optional(),
});

@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get("finance/summary")
  @RequirePermission("read", "invoice")
  financeSummary(@Query(ZodQuery(z.object({ tab: z.enum(["invoices", "payments", "expenses"]).default("invoices") }))) q: { tab: "invoices" | "payments" | "expenses" }) {
    return this.service.financeSummary(q.tab);
  }

  @Get("invoices")
  @RequirePermission("read", "invoice")
  listInvoices(@Query(ZodQuery(z.object({ status: z.string().optional(), clientId: z.string().optional() }))) q: { status?: string; clientId?: string }) {
    return this.service.listInvoices(q.status, q.clientId);
  }

  @Post("invoices")
  @HttpCode(201)
  @RequirePermission("create", "invoice")
  createInvoice(@Body(ZodBody(createInvoice)) body: z.infer<typeof createInvoice>, @CurrentUser() user: Principal) {
    return this.service.createInvoice(body, user.userId);
  }

  @Get("invoices/:id")
  @RequirePermission("read", "invoice")
  getInvoice(@Param("id") id: string) {
    return this.service.getInvoice(id);
  }

  @Patch("invoices/:id")
  @RequirePermission("create", "invoice")
  updateInvoice(@Param("id") id: string, @Body(ZodBody(updateInvoice)) body: z.infer<typeof updateInvoice>) {
    return this.service.updateInvoice(id, body);
  }

  @Post("invoices/:id/issue")
  @RequirePermission("issue", "invoice")
  issue(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.invoiceAction(id, "issue", user.userId);
  }

  @Post("invoices/:id/send")
  @RequirePermission("send", "invoice")
  send(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.invoiceAction(id, "send", user.userId);
  }

  @Post("invoices/:id/void")
  @RequirePermission("void", "invoice")
  void(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.invoiceAction(id, "void", user.userId);
  }

  @Get("payments")
  @RequirePermission("read", "payment")
  listPayments() {
    return this.service.listPayments();
  }

  @Post("payments")
  @HttpCode(201)
  @RequirePermission("record", "payment")
  recordPayment(@Body(ZodBody(recordPayment)) body: z.infer<typeof recordPayment>, @CurrentUser() user: Principal) {
    return this.service.recordPayment(body, user.userId);
  }

  @Get("expenses")
  @RequirePermission("read", "expense")
  listExpenses(@Query(ZodQuery(z.object({ status: z.string().optional() }))) q: { status?: string }) {
    return this.service.listExpenses(q.status);
  }

  @Post("expenses")
  @HttpCode(201)
  @RequirePermission("record", "expense")
  recordExpense(@Body(ZodBody(recordExpense)) body: z.infer<typeof recordExpense>, @CurrentUser() user: Principal) {
    return this.service.recordExpense(body, user.userId);
  }

  @Post("expenses/:id/approve")
  @RequirePermission("approve", "expense")
  approveExpense(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.approveExpense(id, user.userId);
  }
}
