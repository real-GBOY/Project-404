import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { ValidationError } from "../../../../../core/kernel/errors.js";
import { CurrentUser, RequirePermission } from "../../../../../core/http/decorators.js";
import { JwtAuthGuard } from "../../../../../core/http/jwt-auth.guard.js";
import { PermissionGuard } from "../../../../../core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "../../../../../core/http/zod.pipe.js";
import type { Principal } from "../../../../../core/http/principal.js";
import { DocumentsService } from "./documents-service.js";

const listQuery = z.object({
  matterId: z.string().optional(),
  q: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["all", "draft", "final", "filed", "signed"]).optional(),
});
const jsonCreate = z.object({
  name: z.string().trim().min(1).max(400),
  matterId: z.string().nullish(),
  category: z.string().trim().max(80).optional(),
});
const updateSchema = z.object({
  name: z.string().trim().min(1).max(400).optional(),
  category: z.string().trim().max(80).optional(),
  status: z.enum(["draft", "final", "filed", "signed"]).optional(),
});

@Controller("documents")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get("summary")
  @RequirePermission("read", "document")
  summary() {
    return this.service.summary();
  }

  @Get()
  @RequirePermission("read", "document")
  list(@Query(ZodQuery(listQuery)) q: z.infer<typeof listQuery>) {
    return this.service.list(q);
  }

  /** multipart (file upload) or JSON (metadata-only). */
  @Post()
  @HttpCode(201)
  @RequirePermission("upload", "document")
  async create(@Req() req: FastifyRequest, @CurrentUser() user: Principal) {
    const contentType = req.headers["content-type"] ?? "";
    if (contentType.includes("multipart/form-data")) {
      const uploaded = await req.file();
      if (!uploaded) throw ValidationError("document.no_file", "Send the file as multipart/form-data.");
      const content = await uploaded.toBuffer();
      const fields = uploaded.fields as Record<string, { value?: string } | undefined>;
      const name = fields.name?.value || uploaded.filename || "Untitled.pdf";
      const matterId = fields.matterId?.value || null;
      const category = fields.category?.value || "Other";
      return this.service.upload(
        { name, matterId, category, file: { content, originalName: uploaded.filename, contentType: uploaded.mimetype } },
        user.userId,
      );
    }
    const body = jsonCreate.parse(req.body ?? {});
    return this.service.upload(
      { name: body.name, matterId: body.matterId ?? null, category: body.category ?? "Other" },
      user.userId,
    );
  }

  @Get(":id")
  @RequirePermission("read", "document")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Patch(":id")
  @RequirePermission("update", "document")
  update(@Param("id") id: string, @Body(ZodBody(updateSchema)) body: z.infer<typeof updateSchema>) {
    return this.service.update(id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermission("delete", "document")
  async remove(@Param("id") id: string) {
    await this.service.remove(id);
  }
}
