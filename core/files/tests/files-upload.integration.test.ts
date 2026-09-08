import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import { setConfigForTests } from "@core/kernel/config.js";
import { IdentityService } from "@core/identity/application/identity-service.js";
import { OrganizationService } from "@core/organizations/application/organization-service.js";
import { FileStorageService } from "@core/files/infrastructure/file-storage.js";
import { FileRepository } from "@core/files/infrastructure/file-repository.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { asUser, createTestCore, get, hasTestDb } from "@core/tests/helpers.js";

/**
 * The presigned-upload lifecycle end to end on the **local** driver:
 *   createUpload → row is `pending`
 *     → writeBytes  (what `PUT /api/files/:id/bytes` does)
 *       → confirmUpload → row is `stored`, real byte_size, content round-trips
 * plus tenant isolation — tenant B can neither confirm nor read tenant A's file
 * (RLS on `files`).
 */
const suite = hasTestDb ? describe : describe.skip;

suite("files — presigned upload lifecycle", () => {
  let core: TestingModule;
  let storageDir: string;
  let userA: string;
  let orgA: string;
  let userB: string;
  let orgB: string;

  const files = () => get(core, FileStorageService);
  const repo = () => get(core, FileRepository);
  const pw = "correct horse battery staple";

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), "auric-files-"));
    setConfigForTests({ fileStoragePath: storageDir });

    core = await createTestCore();
    // createTestCore → applyTestConfig merges over the cached config without
    // touching fileStoragePath, so the temp dir above survives.
    setConfigForTests({ fileStoragePath: storageDir });

    const id = get(core, IdentityService);
    const orgs = get(core, OrganizationService);
    userA = (await id.register({ email: `fa+${Date.now()}@t.test`, password: pw })).id;
    userB = (await id.register({ email: `fb+${Date.now()}@t.test`, password: pw })).id;
    orgA = (await orgs.createOrganization({ name: "Files Org A", createdBy: userA })).id;
    orgB = (await orgs.createOrganization({ name: "Files Org B", createdBy: userB })).id;
  }, 60_000);

  afterAll(async () => {
    await core?.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it("createUpload records a pending file and returns a PUT target", async () => {
    const { fileId, upload } = await asUser(userA, orgA, () =>
      files().createUpload({
        originalName: "brief.pdf",
        contentType: "application/pdf",
        byteSize: 11,
        ownerId: userA,
      }),
    );

    expect(upload.method).toBe("PUT");
    expect(upload.url).toBe(`/files/${fileId}/bytes`);
    expect(upload.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const row = await asUser(userA, orgA, () => readInTenant(() => repo().findById(fileId)));
    expect(row?.status).toBe("pending");
    expect(row?.committedAt).toBeNull();
  });

  it("writeBytes → confirmUpload flips the file to stored with the real size", async () => {
    const bytes = Buffer.from("hello presigned world");

    const { fileId } = await asUser(userA, orgA, () =>
      files().createUpload({
        originalName: "note.txt",
        contentType: "text/plain",
        byteSize: 999, // deliberately wrong — confirm should reconcile to the real size
        ownerId: userA,
      }),
    );

    await asUser(userA, orgA, () => files().writeBytes(fileId, bytes));

    const ref = await asUser(userA, orgA, () => files().confirmUpload(fileId));
    expect(ref.byteSize).toBe(bytes.byteLength);

    const row = await asUser(userA, orgA, () => readInTenant(() => repo().findById(fileId)));
    expect(row?.status).toBe("stored");
    expect(row?.byteSize).toBe(bytes.byteLength);
    expect(row?.committedAt).toBeInstanceOf(Date);

    const { content } = await asUser(userA, orgA, () => files().getContent({ id: fileId }));
    expect(content.equals(bytes)).toBe(true);
  });

  it("confirmUpload before the bytes land is a clean validation error", async () => {
    const { fileId } = await asUser(userA, orgA, () =>
      files().createUpload({
        originalName: "empty.bin",
        contentType: "application/octet-stream",
        byteSize: 4,
        ownerId: userA,
      }),
    );

    await expect(asUser(userA, orgA, () => files().confirmUpload(fileId))).rejects.toMatchObject({
      code: "files.upload_missing",
    });
  });

  it("a pending file cannot be downloaded", async () => {
    const { fileId } = await asUser(userA, orgA, () =>
      files().createUpload({
        originalName: "pending.pdf",
        contentType: "application/pdf",
        byteSize: 10,
        ownerId: userA,
      }),
    );

    await expect(
      asUser(userA, orgA, () => files().getContent({ id: fileId })),
    ).rejects.toMatchObject({ code: "files.upload_pending" });
  });

  it("tenant B can neither confirm nor read tenant A's file", async () => {
    const bytes = Buffer.from("tenant A secret");
    const { fileId } = await asUser(userA, orgA, () =>
      files().createUpload({
        originalName: "secret.txt",
        contentType: "text/plain",
        byteSize: bytes.byteLength,
        ownerId: userA,
      }),
    );
    await asUser(userA, orgA, () => files().writeBytes(fileId, bytes));

    await expect(asUser(userB, orgB, () => files().confirmUpload(fileId))).rejects.toMatchObject({
      code: "files.not_found",
    });
    await expect(
      asUser(userB, orgB, () => files().getContent({ id: fileId })),
    ).rejects.toMatchObject({ code: "files.not_found" });

    // …and tenant A still can.
    await expect(asUser(userA, orgA, () => files().confirmUpload(fileId))).resolves.toMatchObject({
      byteSize: bytes.byteLength,
    });
  });
});
