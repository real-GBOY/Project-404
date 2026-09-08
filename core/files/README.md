# `core/files` — file storage

## 1. What it is

Upload / download / delete / metadata for binary files (Plan §7.6), RBAC-gated,
tenant-scoped, behind a swappable storage adapter. Ships two adapters — local
disk (dev/tests) and **Cloudflare R2** — behind one `IFileStorage` contract, so
switching drivers is a config flag with **no use-case change**.

Uploads use a **presigned-URL flow**: the client asks the API for a short-lived
upload URL, `PUT`s the bytes straight to storage (never through the API
process), then calls `confirm`, which HEADs the object and marks the file
`stored`. `presign ≠ upload complete`; `confirm` is not a status flip, it
verifies the object exists. The old single-request multipart `POST /api/files`
stays for server-side / small uploads.

## 2. Why it exists

Every application stores documents. The parts that are always the same — a file
record with metadata, a permission check, a tenant-namespaced storage key, a
signed-URL or streamed download — belong in Core once.

## 3. What problem it solves

- Domain code (Mizan documents, matter attachments) never touches S3/Cloudinary
  or the filesystem directly (Plan §47 rule 9).
- Tenant isolation for files: the storage key is namespaced by `organization_id`
  and the record is RLS-scoped.
- One place to enforce "can this user read/write this file".

## 4. Responsibilities

- `FileStorageService` (`IFileStorage`): `upload` (buffer), `createUpload` +
  `confirmUpload` (presigned), `writeBytes` (local loopback), `getUrl`,
  `getContent`, `delete`.
- `FileRepository` — the `files` table (id, storageKey, contentType, byteSize,
  originalName, ownerId, visibility, metadata, `status`, `committed_at`).
- `StorageAdapter` implementations (`STORAGE_ADAPTER`) — actually move bytes:
  - `LocalDiskAdapter` — filesystem under `AURIC_FILE_STORAGE_PATH`; `presignPut`
    returns the API's own authenticated loopback route.
  - `R2Adapter` — Cloudflare R2 over its S3 API, signed with the hand-rolled
    SigV4 in `sigv4.ts` (no AWS SDK).
- Permission checks on the HTTP surface.

### The presigned upload flow

```
client                         API                         storage (R2 / local disk)
  │  POST /api/files/uploads     │                            │
  │ ───────────────────────────▶ │  insert file row `pending`  │
  │                              │  adapter.presignPut(key) ──▶│
  │ ◀─────────────────────────── │  { fileId, upload }         │
  │                              │                            │
  │  PUT upload.url  (raw bytes) ──────────────────────────────▶│  (r2: presigned S3 URL,
  │ ◀──────────────────────────────────────────────────── 204  │   no auth header;
  │                              │                            │   local: /api/files/:id/bytes,
  │  POST /api/files/:id/confirm  │                            │   bearer-authenticated)
  │ ───────────────────────────▶ │  adapter.head(key) ───────▶ │
  │                              │  markStored(realSize,etag)  │
  │ ◀─────────────────────────── │  { file }  (now `stored`)   │
```

`status` starts `pending`; a pending file 404s / rejects on download and
`getUrl`. `confirm` is idempotent. The buffer `upload()` path writes bytes
first, so it inserts `stored` directly — that is the column default.

## 5. What it owns

The `files` table (`prisma/schema/files.prisma`), the `FileRef` public shape,
the storage-key scheme (`<org>/<id>/<name>`), and the local-disk layout under
`AURIC_FILE_STORAGE_PATH`.

## 6. What it explicitly does NOT own

- **What a file *is* in the product** — "Statement of Defence", "invoice PDF",
  category, review status, matter linkage: that is Mizan's `documents` module,
  which *references* a `fileId` and adds its own metadata.
- Virus scanning, thumbnailing, OCR, format conversion — background jobs added
  per real requirement.
- A CDN or public bucket — `visibility: "public"` is a flag; wiring a CDN is
  infra, not this module.

## 7. Public surface

- `FilesModule` — exports token `FILE_STORAGE` (`IFileStorage`).
- HTTP (`/api/files`):
  - `POST /uploads` — begin a presigned upload → `{ fileId, upload }` (`upload:file`)
  - `PUT /:id/bytes` — local-driver loopback: raw `application/octet-stream` body → 204
  - `POST /:id/confirm` — finalize → `{ file }`
  - `POST /` — legacy single-request multipart upload
  - `GET /:id`, `GET /:id/metadata`, `DELETE /:id`
- See `http/09-files.http` for a runnable end-to-end example.

### Configuration

| Env var | Required | Default | Notes |
|---|---|---|---|
| `AURIC_FILE_STORAGE_DRIVER` | — | `local` | `local` or `r2` |
| `AURIC_FILE_PRESIGN_TTL_SECONDS` | — | `900` | upload/download URL lifetime |
| `AURIC_FILE_MAX_UPLOAD_BYTES` | — | `26214400` | 25 MiB hard cap |
| `AURIC_FILE_ALLOWED_MIME_TYPES` | — | *(empty = any)* | comma-separated allowlist |
| `AURIC_R2_ACCOUNT_ID` | r2 | — | R2 overview page |
| `AURIC_R2_ACCESS_KEY_ID` | r2 | — | R2 → *Manage R2 API Tokens* |
| `AURIC_R2_SECRET_ACCESS_KEY` | r2 | — | shown once when the token is created |
| `AURIC_R2_BUCKET` | r2 | — | bucket name |
| `AURIC_R2_ENDPOINT` | — | `https://<account>.r2.cloudflarestorage.com` | override only if needed |
| `AURIC_R2_PUBLIC_BASE_URL` | — | — | custom domain / `r2.dev` for `visibility:"public"` files |

Starting with `driver=r2` and any of the four required R2 vars missing fails
config validation at boot. **Never** commit real credentials — they live only in
`.env` / the deployment secret store.

For browser uploads straight to R2, the bucket needs a CORS rule allowing `PUT`
from the web origin (R2 dashboard → bucket → *Settings* → *CORS policy*).

## 8. How to use

Mizan's document use case:

```ts
constructor(@Inject(FILE_STORAGE) private readonly files: IFileStorage) {}

async attach(input: { content: Buffer; name: string; matterId: string }) {
  const ref = await this.files.upload({
    content: input.content, originalName: input.name, contentType: "application/pdf",
  });
  await this.documentRepo.insert({ id: newId("doc"), fileId: ref.id, matterId: input.matterId, /* … */ });
}
```

Never `fs.writeFile` / `new S3Client()` in domain code.

## 9. Dependencies & direction

Imports `RbacModule` (permission checks). Consumed by any module that stores
files. Depends on nothing above it in Core.

## 10. Invariants

1. Bytes are only ever touched through `STORAGE_ADAPTER`; swapping the adapter
   changes nothing above it.
2. Storage keys are tenant-namespaced; a file record is RLS-scoped.
3. `delete` removes the record **and** the bytes.
4. Access is permission-checked; ownership/visibility is enforced server-side.
5. Large files stream — `getContent` returns a `Buffer` today, but callers must
   not assume the whole file fits in memory forever (an S3 adapter will stream).

## 11. Adding another storage driver

Implement `StorageAdapter` (`put`/`get`/`remove`/`url`, plus optional
`presignPut`/`head` for the direct-upload flow), bind it to `STORAGE_ADAPTER` in
`files.module.ts` behind a `fileStorageDriver` value. `FileStorageService`, the
`files` table, every controller, and all of Mizan stay untouched — `R2Adapter`
was added exactly this way.

### Manual R2 check

1. Create a bucket + an API token (R2 → *Manage R2 API Tokens*), put the four
   `AURIC_R2_*` vars in `.env`, set `AURIC_FILE_STORAGE_DRIVER=r2`.
2. Run `http/09-files.http`: `POST /files/uploads`, then `PUT` the returned
   absolute `upload.url` with **no** `Authorization` header, then
   `POST /files/:id/confirm`, then `GET /files/:id`.
3. Confirm the object appears in the bucket and the file row is `stored` with the
   real `byte_size`.

## 12. Testing expectations

`core/files/tests/`: round-trip upload → getContent; delete removes bytes;
unauthorized read/delete is 403; **tenant A cannot fetch tenant B's file** by id;
metadata is preserved; the adapter interface is honoured by a fake in use-case
tests.

## 13. When NOT to extend it

- To add product document semantics (category, status, matter link) — those are
  Mizan's `documents` module.
- To add processing pipelines (thumbnails, OCR) before a feature needs them.
- To bypass the adapter for "just this one" direct filesystem/S3 call.
