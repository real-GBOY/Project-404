import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { Forbidden, ValidationError } from "@core/kernel/errors.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { PERMISSION_PROVIDER } from "@core/kernel/tokens.js";
import { CurrentUser, RequirePermission } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { PermissionGuard } from "@core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import type { IPermissionProvider } from "@core/contracts/index.js";
import { FileStorageService } from "@core/files/infrastructure/file-storage.js";

const uploadQuery = z.object({ visibility: z.enum(["private", "public"]).optional() });

const createUploadBody = z.object({
  originalName: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(1).max(200),
  byteSize: z.number().int().positive(),
  visibility: z.enum(["private", "public"]).optional(),
  checksumSha256: z.string().trim().length(64).optional(),
});

/**
 * Direct file endpoints. Access control is RBAC (§7.6): a user may always reach
 * their own files; reaching someone else's needs `file:read` / `file:delete`.
 * Multipart parsing is registered on the Fastify adapter in `main.ts`.
 */
@ApiTags("files")
@ApiBearerAuth("access-token")
@Controller("files")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FilesController {
  constructor(
    private readonly files: FileStorageService,
    @Inject(PERMISSION_PROVIDER) private readonly permissions: IPermissionProvider,
  ) {}

  /**
   * POST /api/files — multipart upload, one file. `?visibility=private|public`
   * (default private). 201 `{ file }`. Needs `upload:file`. The row is tagged
   * with the active tenant and the bytes stored under `org_/…` (§ docs/tenancy.md).
   */
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
    if (content.length === 0)
      throw ValidationError("files.empty_file", "The uploaded file is empty.");

    const ref = await this.files.upload({
      content,
      originalName: uploaded.filename,
      contentType: uploaded.mimetype || "application/octet-stream",
      ownerId: user.userId,
      visibility: q.visibility ?? "private",
    });
    return { file: ref };
  }

  /**
   * POST /api/files/uploads — begin a presigned upload. 201
   * `{ fileId, upload: { url, method, headers, expiresAt } }`. Needs
   * `upload:file`. The client then PUTs the bytes to `upload.url` and calls
   * `POST /api/files/:id/confirm`. The file is `pending` until confirmed.
   */
  @Post("uploads")
  @HttpCode(201)
  @RequirePermission("upload", "file")
  async createUpload(
    @Body(ZodBody(createUploadBody)) body: z.infer<typeof createUploadBody>,
    @CurrentUser() user: Principal,
  ) {
    return this.files.createUpload({
      originalName: body.originalName,
      contentType: body.contentType,
      byteSize: body.byteSize,
      ownerId: user.userId,
      visibility: body.visibility ?? "private",
      checksumSha256: body.checksumSha256,
    });
  }

  /**
   * PUT /api/files/:id/bytes — the local driver's authenticated loopback
   * upload target (see `LocalDiskAdapter.presignPut`). Raw
   * `application/octet-stream` body. R2 clients never call this — they PUT to
   * the presigned S3 URL directly. 204. Owner, or `upload:file`.
   */
  @Put(":id/bytes")
  @HttpCode(204)
  async putBytes(
    @Param("id") id: string,
    @Req() req: FastifyRequest,
    @CurrentUser() user: Principal,
  ) {
    await this.assertCanWrite(user, id);
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw ValidationError(
        "files.no_bytes",
        "Send the raw file bytes as application/octet-stream.",
      );
    }
    await this.files.writeBytes(id, body);
  }

  /**
   * POST /api/files/:id/confirm — finalize a presigned upload: HEADs the object
   * to verify it landed, then flips the file to `stored`. 200 `{ file }`.
   * Owner, or `upload:file`. Idempotent.
   */
  @Post(":id/confirm")
  @HttpCode(200)
  async confirmUpload(@Param("id") id: string, @CurrentUser() user: Principal) {
    await this.assertCanWrite(user, id);
    const file = await this.files.confirmUpload(id);
    return { file };
  }

  /** GET /api/files/:id/metadata — the file row (no bytes). Public file, or owner, or `read:file`. */
  @Get(":id/metadata")
  async metadata(@Param("id") id: string, @CurrentUser() user: Principal) {
    const meta = await this.files.getMetadata(id);
    await this.assertCanRead(user, meta.ownerId, meta.visibility);
    return { file: meta };
  }

  /** GET /api/files/:id — download the bytes as an attachment. Same access rule as metadata. */
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
      .header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(ref.originalName)}"`,
      )
      .send(content);
  }

  /** DELETE /api/files/:id — soft-delete + remove the bytes (204). Owner, or `delete:file`. */
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

  /** Owner → allowed; otherwise needs `upload:file` in the active tenant. */
  private async assertCanWrite(user: Principal, fileId: string): Promise<void> {
    const meta = await this.files.getMetadata(fileId);
    if (meta.ownerId === user.userId) return;
    if (await readInTenant(() => this.permissions.can(user.userId, "upload", "file"))) return;
    throw Forbidden("files.forbidden", "You cannot modify this file.");
  }

  /** Public → allowed; owner → allowed; otherwise needs `read:file` in the active tenant. */
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
