import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import { FinancialReportsService } from "../application/financial-reports-service.js";
import {
  createFinancialReportSchema,
  listFinancialReportsQuery,
  type CreateFinancialReportBody,
  type ListFinancialReportsQuery,
} from "../validation/financial-reports.schema.js";

@ApiTags("realestate · financial reports")
@ApiBearerAuth("access-token")
@Controller("realestate/financial-reports")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FinancialReportsController {
  constructor(private readonly service: FinancialReportsService) {}

  @Get()
  @RequirePermission("read", "financial_report")
  list(@Query(ZodQuery(listFinancialReportsQuery)) q: ListFinancialReportsQuery) {
    return this.service.list(q);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "financial_report")
  create(@Body(ZodBody(createFinancialReportSchema)) body: CreateFinancialReportBody) {
    return this.service.create(body);
  }
}
