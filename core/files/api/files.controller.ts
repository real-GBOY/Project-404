import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { Forbidden, ValidationError } from "../../kernel/errors.js";
import { readInTenant } from "../../kernel/db/db.js";
import { PERMISSION_PROVIDER } from "../../kernel/tokens.js";
import { CurrentUser, RequirePermission } from "../../http/decorators.js";
import { JwtAuthGuard } from "../../http/jwt-auth.guard.js";
import { PermissionGuard } from "../../http/permission.guard.js";
import { ZodQuery } from "../../http/zod.pipe.js";
import type { Principal } from "../../http/principal.js";
import type { IPermissionProvider } from "../../contracts/index.js";
import { FileStorageService } from "../infrastructure/file-storage.js";

const uploadQuery = z.object({ visibility: z.enum(["private", "public"]).optional() });

/**
 * Direct file endpoints. Access control is RBAC (§7.6): a user may always reach
 * their own files; reaching someone else's needs `file:read` / `file:delete`.
 * Multipart parsing is registered on the Fastify adapter in `main.ts`.
 */
@Controller("files")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FilesController {
  constructor(
    private readonly files: FileStorageService,
    @Inject(PERMISSION_PROVIDER) private readonly permissions: IPermissionProvider,
  ) {}

  @Post()
  @HttpCode(201)
  @RequirePermission("upload", "file")
  async upload(
    @Req() req: FastifyRequest,
    @Query(ZodQuery(uploadQuery)) q: z.infer<typeof uploadQuery>,
    @CurrentUser() user: Principal,
  ) {
    const uploaded = await req.file();
    if (!uploaded) throw ValidationError("files.no_file", "Send the file as multipart/form-data.");
    const content = await uploaded.toBuffer();
    if (content.length === 0) throw ValidationError("files.empty_file", "The uploaded file is empty.");

    const ref = await this.files.upload({
      content,
      originalName: uploaded.filename,
      contentType: uploaded.mimetype || "application/octet-stream",
      ownerId: user.userId,
      visibility: q.visibility ?? "private",
    });
    return { file: ref };
  }

  @Get(":id/metadata")
  async metadata(@Param("id") id: string, @CurrentUser() user: Principal) {
    const meta = await this.files.getMetadata(id);
    await this.assertCanRead(user, meta.ownerId, meta.visibility);
    return { file: meta };
  }

  @Get(":id")
  async download(
    @Param("id") id: string,
    @CurrentUser() user: Principal,
    @Res() reply: FastifyReply,
  ) {
    const meta = await this.files.getMetadata(id);
    await this.assertCanRead(user, meta.ownerId, meta.visibility);
    const { content, ref } = await this.files.getContent({ id });
    reply
      .header("Content-Type", ref.contentType)
      .header("Content-Disposition", `attachment; filename="${encodeURIComponent(ref.originalName)}"`)
      .send(content);
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string, @CurrentUser() user: Principal) {
    const meta = await this.files.getMetadata(id);
    const canDelete =
      meta.ownerId === user.userId ||
      (await readInTenant(() => this.permissions.can(user.userId, "delete", "file")));
    if (!canDelete) throw Forbidden("files.forbidden", "You cannot delete this file.");
    await this.files.delete({ id });
  }

  private async assertCanRead(
    user: Principal,
    ownerId: string | null,
    visibility: "private" | "public",
  ): Promise<void> {
    if (visibility === "public") return;
    if (ownerId === user.userId) return;
    if (await readInTenant(() => this.permissions.can(user.userId, "read", "file"))) return;
    throw Forbidden("files.forbidden", "You cannot access this file.");
  }
}
