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
 * The presigned-upload lifecycle against a **real Cloudflare R2 bucket** —
 * the production `r2` driver, not a stub. Opt-in: needs both a test DB and R2
 * credentials in the environment (AURIC_R2_ACCESS_KEY_ID etc.); skipped
 * otherwise, so it never runs in CI.
 *
 *   createUpload → row `pending`, real S3 presigned PUT URL
 *     → browser-style PUT of the bytes straight to R2 (no Authorization header)
 *       → confirmUpload → HEAD verifies the object, size reconciled, row `stored`
 *         → getContent / getUrl round-trip the bytes
 *           → delete removes the row and the object
 */
const live = hasTestDb && process.env.AURIC_R2_ACCESS_KEY_ID ? describe : describe.skip;

live("files — presigned upload lifecycle on real R2", () => {
  let core: TestingModule;
  let user: string;
  let org: string;

  const files = () => get(core, FileStorageService);
  const repo = () => get(core, FileRepository);
  const pw = "correct horse battery staple";

  beforeAll(async () => {
    setConfigForTests({
      fileStorageDriver: "r2",
      r2AccountId: process.env.AURIC_R2_ACCOUNT_ID,
      r2AccessKeyId: process.env.AURIC_R2_ACCESS_KEY_ID,
      r2SecretAccessKey: process.env.AURIC_R2_SECRET_ACCESS_KEY,
      r2Bucket: process.env.AURIC_R2_BUCKET ?? "mizan-files",
      r2Endpoint: process.env.AURIC_R2_ENDPOINT,
    });

    core = await createTestCore();
    // createTestCore → applyTestConfig merges, leaving the r2 keys above intact.
    setConfigForTests({
      fileStorageDriver: "r2",
      r2AccountId: process.env.AURIC_R2_ACCOUNT_ID,
      r2AccessKeyId: process.env.AURIC_R2_ACCESS_KEY_ID,
      r2SecretAccessKey: process.env.AURIC_R2_SECRET_ACCESS_KEY,
      r2Bucket: process.env.AURIC_R2_BUCKET ?? "mizan-files",
      r2Endpoint: process.env.AURIC_R2_ENDPOINT,
    });

    const id = get(core, IdentityService);
    const orgs = get(core, OrganizationService);
    user = (await id.register({ email: `r2live+${Date.now()}@t.test`, password: pw })).id;
    org = (await orgs.createOrganization({ name: "R2 Live Org", createdBy: user })).id;
  }, 60_000);

  afterAll(async () => {
    await core?.close();
  });

  it("uses the real r2 driver", () => {
    expect(files()["adapter"].driver).toBe("r2");
  });

  it("createUpload → PUT to R2 → confirmUpload → download → delete", async () => {
    const bytes = Buffer.from(`R2 live integration @ ${new Date().toISOString()}\n`);

    const { fileId, upload } = await asUser(user, org, () =>
      files().createUpload({
        originalName: "brief.txt",
        contentType: "text/plain",
        byteSize: 1, // deliberately wrong — confirm reconciles to the real size
        ownerId: user,
      }),
    );

    expect(upload.url).toMatch(/^https:\/\/[^/]+\.r2\.cloudflarestorage\.com\//);
    expect(upload.url).toContain("X-Amz-Signature=");

    let row = await asUser(user, org, () => readInTenant(() => repo().findById(fileId)));
    expect(row?.status).toBe("pending");

    // Browser-style upload: raw PUT, no bearer/Authorization header.
    const put = await fetch(upload.url, {
      method: "PUT",
      body: bytes,
      headers: { "Content-Type": "text/plain" },
    });
    expect(put.status, await put.text().catch(() => "")).toBe(200);

    const ref = await asUser(user, org, () => files().confirmUpload(fileId));
    expect(ref.byteSize).toBe(bytes.byteLength);

    row = await asUser(user, org, () => readInTenant(() => repo().findById(fileId)));
    expect(row?.status).toBe("stored");
    expect(row?.byteSize).toBe(bytes.byteLength);
    expect(row?.committedAt).toBeInstanceOf(Date);

    // Server-side fetch of the private object.
    const { content } = await asUser(user, org, () => files().getContent({ id: fileId }));
    expect(content.equals(bytes)).toBe(true);

    // Presigned GET URL, fetched with a bare client.
    const dlUrl = await asUser(user, org, () => files().getUrl({ id: fileId }));
    const dl = await fetch(dlUrl);
    expect(dl.status).toBe(200);
    expect(await dl.text()).toBe(bytes.toString());

    // Cleanup — soft-deletes the row and removes the object from R2.
    await asUser(user, org, () => files().delete({ id: fileId }));
  }, 60_000);

  it("confirmUpload before the bytes land → files.upload_missing", async () => {
    const { fileId } = await asUser(user, org, () =>
      files().createUpload({
        originalName: "ghost.bin",
        contentType: "application/octet-stream",
        byteSize: 8,
        ownerId: user,
      }),
    );
    await expect(asUser(user, org, () => files().confirmUpload(fileId))).rejects.toMatchObject({
      code: "files.upload_missing",
    });
  }, 60_000);
});
