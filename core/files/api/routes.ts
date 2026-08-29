import { Router, raw } from "express";
import { z } from "zod";
import { handler, parseQuery } from "../../http/handler.js";
import type { RouteContext } from "../../http/route-context.js";
import { requireAuth } from "../../identity/api/auth-middleware.js";
import { Forbidden, ValidationError } from "../../kernel/errors.js";
import type { IPermissionProvider } from "../../contracts/index.js";
import type { FileStorageService } from "../infrastructure/file-storage.js";

const uploadQuery = z.object({
  filename: z.string().trim().min(1).max(255),
  visibility: z.enum(["private", "public"]).optional(),
});

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Direct file endpoints. Access control is RBAC (§7.6): a user may always
 * reach their own files; reaching someone else's needs `file:read` /
 * `file:delete`.
 */
export function fileRoutes(
  files: FileStorageService,
  permissions: IPermissionProvider,
  ctx: RouteContext,
): Router {
  const r = Router();

  r.post(
    "/files",
    ctx.authenticate,
    ctx.guard("upload", "file"),
    raw({ type: "*/*", limit: MAX_BYTES }),
    handler(async (req, res) => {
      const { filename, visibility } = parseQuery(uploadQuery, req.query);
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw ValidationError("files.empty_body", "The request body must contain the file bytes.");
      }
      const principal = requireAuth(req);
      const ref = await files.upload({
        content: body,
        originalName: filename,
        contentType: req.headers["content-type"] ?? "application/octet-stream",
        ownerId: principal.userId,
        visibility: visibility ?? "private",
      });
      res.status(201).json({ file: ref });
    }),
  );

  r.get(
    "/files/:id/metadata",
    ctx.authenticate,
    handler(async (req, res) => {
      const meta = await files.getMetadata(req.params.id);
      await assertCanRead(permissions, req, meta.ownerId, meta.visibility);
      res.json({ file: meta });
    }),
  );

  r.get(
    "/files/:id",
    ctx.authenticate,
    handler(async (req, res) => {
      const meta = await files.getMetadata(req.params.id);
      await assertCanRead(permissions, req, meta.ownerId, meta.visibility);
      const { content, ref } = await files.getContent({ id: req.params.id });
      res.setHeader("Content-Type", ref.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(ref.originalName)}"`);
      res.send(content);
    }),
  );

  r.delete(
    "/files/:id",
    ctx.authenticate,
    handler(async (req, res) => {
      const meta = await files.getMetadata(req.params.id);
      const principal = requireAuth(req);
      if (meta.ownerId !== principal.userId) {
        if (!(await permissions.can(principal.userId, "delete", "file"))) {
          throw Forbidden("files.forbidden", "You cannot delete this file.");
        }
      }
      await files.delete({ id: req.params.id });
      res.status(204).end();
    }),
  );

  return r;
}

async function assertCanRead(
  permissions: IPermissionProvider,
  req: Parameters<typeof requireAuth>[0],
  ownerId: string | null,
  visibility: "private" | "public",
): Promise<void> {
  if (visibility === "public") return;
  const principal = requireAuth(req);
  if (ownerId === principal.userId) return;
  if (await permissions.can(principal.userId, "read", "file")) return;
  throw Forbidden("files.forbidden", "You cannot access this file.");
}
