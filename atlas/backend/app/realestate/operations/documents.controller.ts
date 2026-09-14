import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import { DocumentsService } from "./documents-service.js";
import {
  createDocumentSchema,
  listDocumentsQuery,
  type CreateDocumentBody,
  type ListDocumentsQuery,
} from "./documents.schema.js";

@ApiTags("realestate · documents")
@ApiBearerAuth("access-token")
@Controller("realestate/documents")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @RequirePermission("read", "document")
  list(@Query(ZodQuery(listDocumentsQuery)) q: ListDocumentsQuery) {
    return this.service.list(q.relatedType, q.relatedId);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("upload", "document")
  create(@Body(ZodBody(createDocumentSchema)) body: CreateDocumentBody) {
    return this.service.create(body);
  }
}
