import { randomBytes } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import { getConfig, setConfigForTests } from "@core/kernel/config.js";
import { STORAGE_ADAPTER } from "@core/kernel/tokens.js";
import { IdentityService } from "@core/identity/application/identity-service.js";
import { OrganizationService } from "@core/organizations/application/organization-service.js";
import { FileStorageService } from "@core/files/infrastructure/file-storage.js";
import { FileRepository } from "@core/files/infrastructure/file-repository.js";
import { R2Adapter } from "@core/files/infrastructure/r2-adapter.js";
import type { StorageAdapter } from "@core/files/infrastructure/storage-adapter.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { asUser, createTestCore, get, hasTestDb } from "@core/tests/helpers.js";

/**
 * The presigned-upload middleware exercised against a **real Cloudflare R2
 * bucket** — the production `r2` driver, end to end. Opt-in: needs a test DB
 * and R2 credentials in the environment (AURIC_R2_ACCESS_KEY_ID etc.); skipped
 * otherwise, so CI never runs it.
 *
 *   node --import @swc-node/register/esm-register node_modules/vitest/vitest.mjs \
 *     run core/files/tests/r2-live.integration.test.ts
 *   (with AURIC_R2_* + AURIC_TEST_DATABASE_URL set)
 */
const HAVE_R2 = Boolean(process.env.AURIC_R2_ACCESS_KEY_ID && process.env.AURIC_R2_SECRET_ACCESS_KEY);
const live = hasTestDb && HAVE_R2 ? describe : describe.skip;

const R2_CONFIG = {
  fileStorageDriver: "r2" as const,
  r2AccountId: process.env.AURIC_R2_ACCOUNT_ID,
  r2AccessKeyId: process.env.AURIC_R2_ACCESS_KEY_ID,
  r2SecretAccessKey: process.env.AURIC_R2_SECRET_ACCESS_KEY,
  r2Bucket: process.env.AURIC_R2_BUCKET ?? "mizan-files",
  r2Endpoint: process.env.AURIC_R2_ENDPOINT,
};

const MAX_BYTES = 1_048_576; // 1 MiB cap for this run — keeps test uploads small
const ALLOWED_MIME = ["text/plain", "application/pdf", "image/png", "application/octet-stream"];

/* ─── Part A — presigned URL properties, straight against R2 (no DB) ───────── */

const adapterDescribe = HAVE_R2 ? describe : describe.skip;

adapterDescribe("R2 presigned URLs — properties", () => {
  const adapter = new R2Adapter({
    accountId: R2_CONFIG.r2AccountId!,
    accessKeyId: R2_CONFIG.r2AccessKeyId!,
    secretAccessKey: R2_CONFIG.r2SecretAccessKey!,
    bucket: R2_CONFIG.r2Bucket,
    endpoint: R2_CONFIG.r2Endpoint,
  });
  const keys: string[] = [];
  const k = (name: string) => {
    const key = `test/presign/${Date.now()}-${name}-${Math.random().toString(36).slice(2)}`;
    keys.push(key);
    return key;
  };

  afterAll(async () => {
    await Promise.allSettled(keys.map((key) => adapter.remove(key)));
  });

  it("a fresh presigned PUT accepts the bytes and preserves them exactly", async () => {
    const key = k("binary");
    const bytes = randomBytes(64 * 1024); // non-UTF-8, 64 KiB

    const up = await adapter.presignPut(key, { contentType: "application/octet-stream", expiresIn: 300 });
    expect(up.url).toMatch(/^https:\/\/[^/]+\.r2\.cloudflarestorage\.com\//);
    expect(new URL(up.url).searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);

    const put = await fetch(up.url, { method: "PUT", body: bytes });
    expect(put.status).toBe(200);

    const head = await adapter.head(key);
    expect(head?.size).toBe(bytes.byteLength);

    const got = await adapter.get(key);
    expect(got.equals(bytes)).toBe(true);
  });

  it("a larger payload (768 KiB) round-trips through the presigned PUT", async () => {
    const key = k("large");
    const bytes = randomBytes(768 * 1024);
    const up = await adapter.presignPut(key, { contentType: "application/octet-stream", expiresIn: 300 });
    expect((await fetch(up.url, { method: "PUT", body: bytes })).status).toBe(200);
    expect((await adapter.get(key)).equals(bytes)).toBe(true);
  });

  it("an expired presigned PUT is rejected by R2 (403)", async () => {
    const key = k("expired-put");
    const up = await adapter.presignPut(key, { contentType: "text/plain", expiresIn: 1 });
    await sleep(2500);
    const put = await fetch(up.url, { method: "PUT", body: "too late" });
    expect(put.status).toBe(403);
    expect(await adapter.head(key)).toBeNull(); // nothing was stored
  });

  it("a tampered presigned PUT signature is rejected by R2 (403)", async () => {
    const key = k("tampered");
    const up = await adapter.presignPut(key, { contentType: "text/plain", expiresIn: 300 });
    const bad = up.url.replace(/(X-Amz-Signature=)([0-9a-f]{4})/, (_m, p1) => `${p1}dead`);
    const put = await fetch(bad, { method: "PUT", body: "nope" });
    expect(put.status).toBe(403);
  });

  it("presigned GET URL works and expires", async () => {
    const key = k("get-ttl");
    await adapter.put(key, Buffer.from("downloadable"));

    // A short TTL, but not so short the URL expires mid-flight — S3/R2 enforce
    // `X-Amz-Expires` strictly (no clock-skew grace), and the round trip to the
    // bucket is a few hundred ms, so 1s races the network.
    const shortLived = new R2Adapter({
      accountId: R2_CONFIG.r2AccountId!,
      accessKeyId: R2_CONFIG.r2AccessKeyId!,
      secretAccessKey: R2_CONFIG.r2SecretAccessKey!,
      bucket: R2_CONFIG.r2Bucket,
      endpoint: R2_CONFIG.r2Endpoint,
      presignTtlSeconds: 5,
    });
    const url = await shortLived.url(key);
    expect((await fetch(url)).status).toBe(200);
    await sleep(7000);
    expect((await fetch(url)).status).toBe(403);
  }, 20_000);

  it("delete really removes the object", async () => {
    const key = k("delete");
    await adapter.put(key, Buffer.from("bye"));
    expect(await adapter.head(key)).not.toBeNull();
    await adapter.remove(key);
    expect(await adapter.head(key)).toBeNull();
    await expect(adapter.remove(key)).resolves.toBeUndefined(); // idempotent
  });
});

/* ─── Part B — the full FileStorageService lifecycle on real R2 ────────────── */

live("files — presigned upload middleware on real R2", () => {
  let core: TestingModule;
  let userA: string;
  let orgA: string;
  let userB: string;
  let orgB: string;

  const files = () => get(core, FileStorageService);
  const repo = () => get(core, FileRepository);
  const adapter = () => get<StorageAdapter>(core, STORAGE_ADAPTER);
  const pw = "correct horse battery staple";

  beforeAll(async () => {
    const overrides = {
      ...R2_CONFIG,
      fileMaxUploadBytes: MAX_BYTES,
      fileAllowedMimeTypes: ALLOWED_MIME,
    };
    setConfigForTests(overrides);
    core = await createTestCore();
    setConfigForTests(overrides);

    const id = get(core, IdentityService);
    const orgs = get(core, OrganizationService);
    userA = (await id.register({ email: `r2a+${Date.now()}@t.test`, password: pw })).id;
    userB = (await id.register({ email: `r2b+${Date.now()}@t.test`, password: pw })).id;
    orgA = (await orgs.createOrganization({ name: "R2 Org A", createdBy: userA })).id;
    orgB = (await orgs.createOrganization({ name: "R2 Org B", createdBy: userB })).id;
  }, 60_000);

  afterAll(async () => {
    await core?.close();
  });

  it("wires the real r2 driver with the configured guards", () => {
    expect(adapter().driver).toBe("r2");
    expect(getConfig().fileMaxUploadBytes).toBe(MAX_BYTES);
    expect(getConfig().fileAllowedMimeTypes).toEqual(ALLOWED_MIME);
  });

  it("createUpload → PUT to R2 → confirm → download → delete (object gone after)", async () => {
    const bytes = randomBytes(40 * 1024); // binary, 40 KiB

    const { fileId, upload } = await asUser(userA, orgA, () =>
      files().createUpload({
        originalName: "brief.bin",
        contentType: "application/octet-stream",
        byteSize: 7, // deliberately wrong — confirm reconciles
        ownerId: userA,
      }),
    );
    expect(upload.url).toContain("X-Amz-Signature=");
    let row = await asUser(userA, orgA, () => readInTenant(() => repo().findById(fileId)));
    expect(row?.status).toBe("pending");
    const storageKey = row!.storageKey;

    const put = await fetch(upload.url, { method: "PUT", body: bytes });
    expect(put.status, await put.text().catch(() => "")).toBe(200);

    const ref = await asUser(userA, orgA, () => files().confirmUpload(fileId));
    expect(ref.byteSize).toBe(bytes.byteLength);

    row = await asUser(userA, orgA, () => readInTenant(() => repo().findById(fileId)));
    expect(row?.status).toBe("stored");
    expect(row?.committedAt).toBeInstanceOf(Date);

    const { content } = await asUser(userA, orgA, () => files().getContent({ id: fileId }));
    expect(content.equals(bytes)).toBe(true);

    const dl = await fetch(await asUser(userA, orgA, () => files().getUrl({ id: fileId })));
    expect(dl.status).toBe(200);
    expect(Buffer.from(await dl.arrayBuffer()).equals(bytes)).toBe(true);

    await asUser(userA, orgA, () => files().delete({ id: fileId }));
    expect(await adapter().head!(storageKey)).toBeNull();
  }, 60_000);

  it("confirmUpload is idempotent", async () => {
    const bytes = Buffer.from("idempotent confirm");
    const { fileId, upload } = await asUser(userA, orgA, () =>
      files().createUpload({
        originalName: "n.txt",
        contentType: "text/plain",
        byteSize: bytes.byteLength,
        ownerId: userA,
      }),
    );
    expect((await fetch(upload.url, { method: "PUT", body: bytes })).status).toBe(200);
    const first = await asUser(userA, orgA, () => files().confirmUpload(fileId));
    const second = await asUser(userA, orgA, () => files().confirmUpload(fileId));
    expect(second).toEqual(first);
    await asUser(userA, orgA, () => files().delete({ id: fileId }));
  }, 60_000);

  it("confirmUpload before the bytes land → files.upload_missing", async () => {
    const { fileId } = await asUser(userA, orgA, () =>
      files().createUpload({
        originalName: "ghost.txt",
        contentType: "text/plain",
        byteSize: 4,
        ownerId: userA,
      }),
    );
    await expect(asUser(userA, orgA, () => files().confirmUpload(fileId))).rejects.toMatchObject({
      code: "files.upload_missing",
    });
  }, 60_000);

  it("a pending file cannot be downloaded → files.upload_pending", async () => {
    const { fileId } = await asUser(userA, orgA, () =>
      files().createUpload({
        originalName: "p.txt",
        contentType: "text/plain",
        byteSize: 5,
        ownerId: userA,
      }),
    );
    await expect(
      asUser(userA, orgA, () => files().getContent({ id: fileId })),
    ).rejects.toMatchObject({ code: "files.upload_pending" });
  });

  it("a disallowed MIME type is rejected before any R2 call", async () => {
    await expect(
      asUser(userA, orgA, () =>
        files().createUpload({
          originalName: "x.exe",
          contentType: "application/x-msdownload",
          byteSize: 10,
          ownerId: userA,
        }),
      ),
    ).rejects.toMatchObject({ code: "files.mime_not_allowed" });
  });

  it("a declared size over the cap is rejected at createUpload", async () => {
    await expect(
      asUser(userA, orgA, () =>
        files().createUpload({
          originalName: "big.bin",
          contentType: "application/octet-stream",
          byteSize: MAX_BYTES + 1,
          ownerId: userA,
        }),
      ),
    ).rejects.toMatchObject({ code: "files.too_large" });
  });

  it("an object that exceeds the cap despite a small declared size is caught at confirm", async () => {
    const { fileId, upload } = await asUser(userA, orgA, () =>
      files().createUpload({
        originalName: "sneaky.bin",
        contentType: "application/octet-stream",
        byteSize: 100, // lies
        ownerId: userA,
      }),
    );
    const oversized = randomBytes(MAX_BYTES + 4096);
    expect((await fetch(upload.url, { method: "PUT", body: oversized })).status).toBe(200);

    await expect(asUser(userA, orgA, () => files().confirmUpload(fileId))).rejects.toMatchObject({
      code: "files.too_large",
    });

    // clean the orphan the rejected confirm leaves in R2
    const row = await asUser(userA, orgA, () =>
      readInTenant(() => repo().findById(fileId, true)),
    );
    if (row) await adapter().remove(row.storageKey);
  }, 60_000);

  it("tenant B can neither confirm nor read tenant A's file", async () => {
    const bytes = Buffer.from("tenant A only");
    const { fileId, upload } = await asUser(userA, orgA, () =>
      files().createUpload({
        originalName: "secret.txt",
        contentType: "text/plain",
        byteSize: bytes.byteLength,
        ownerId: userA,
      }),
    );
    expect((await fetch(upload.url, { method: "PUT", body: bytes })).status).toBe(200);

    await expect(asUser(userB, orgB, () => files().confirmUpload(fileId))).rejects.toMatchObject({
      code: "files.not_found",
    });
    await expect(
      asUser(userB, orgB, () => files().getContent({ id: fileId })),
    ).rejects.toMatchObject({ code: "files.not_found" });

    await expect(asUser(userA, orgA, () => files().confirmUpload(fileId))).resolves.toMatchObject({
      byteSize: bytes.byteLength,
    });
    await asUser(userA, orgA, () => files().delete({ id: fileId }));
  }, 60_000);
});
