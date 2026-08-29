import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { parseQuery } from "../../http/handler.js";
import type { RouteContext } from "../../http/route-context.js";
import { requireAuth, type Principal } from "../../identity/api/auth-middleware.js";
import { Forbidden, ValidationError } from "../../kernel/errors.js";
import type { IPermissionProvider } from "../../contracts/index.js";
import type { FileStorageService } from "../infrastructure/file-storage.js";

const MAX_BYTES = 25 * 1024 * 1024;

const uploadQuery = z.object({ visibility: z.enum(["private", "public"]).optional() });

/**
 * Direct file endpoints. Access control is RBAC (§7.6): a user may always
 * reach their own files; reaching someone else's needs `file:read` /
 * `file:delete`.
 */
export function fileRoutes(
  files: FileStorageService,
  permissions: IPermissionProvider,
  ctx: RouteContext,
): FastifyPluginAsync {
  return async (app) => {
    await app.register(multipart, { limits: { fileSize: MAX_BYTES, files: 1 } });
    app.addHook("preHandler", ctx.authenticate);

    app.post("/files", { preHandler: ctx.guard("upload", "file") }, async (req, reply) => {
      const { visibility } = parseQuery(uploadQuery, req.query);
      const uploaded = await req.file();
      if (!uploaded) throw ValidationError("files.no_file", "Send the file as multipart/form-data.");
      const content = await uploaded.toBuffer();
      if (content.length === 0) throw ValidationError("files.empty_file", "The uploaded file is empty.");

      const ref = await files.upload({
        content,
        originalName: uploaded.filename,
        contentType: uploaded.mimetype || "application/octet-stream",
        ownerId: requireAuth(req).userId,
        visibility: visibility ?? "private",
      });
      reply.status(201).send({ file: ref });
    });

    app.get<{ Params: { id: string } }>("/files/:id/metadata", async (req) => {
      const meta = await files.getMetadata(req.params.id);
      await assertCanRead(permissions, requireAuth(req), meta.ownerId, meta.visibility);
      return { file: meta };
    });

    app.get<{ Params: { id: string } }>("/files/:id", async (req, reply) => {
      const meta = await files.getMetadata(req.params.id);
      await assertCanRead(permissions, requireAuth(req), meta.ownerId, meta.visibility);
      const { content, ref } = await files.getContent({ id: req.params.id });
      reply
        .header("Content-Type", ref.contentType)
        .header("Content-Disposition", `attachment; filename="${encodeURIComponent(ref.originalName)}"`)
        .send(content);
    });

    app.delete<{ Params: { id: string } }>("/files/:id", async (req, reply) => {
      const meta = await files.getMetadata(req.params.id);
      const principal = requireAuth(req);
      if (meta.ownerId !== principal.userId && !(await permissions.can(principal.userId, "delete", "file"))) {
        throw Forbidden("files.forbidden", "You cannot delete this file.");
      }
      await files.delete({ id: req.params.id });
      reply.status(204).send();
    });
  };
}

async function assertCanRead(
  permissions: IPermissionProvider,
  principal: Principal,
  ownerId: string | null,
  visibility: "private" | "public",
): Promise<void> {
  if (visibility === "public") return;
  if (ownerId === principal.userId) return;
  if (await permissions.can(principal.userId, "read", "file")) return;
  throw Forbidden("files.forbidden", "You cannot access this file.");
}
