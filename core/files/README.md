# `core/files` — file storage

## 1. What it is

Upload / download / delete / metadata for binary files (Plan §7.6), RBAC-gated,
tenant-scoped, behind a swappable storage adapter. Ships a local-disk adapter;
the `IFileStorage` contract is designed so an S3 adapter drops in with **no
use-case change**.

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

- `FileStorageService` (`IFileStorage`): `upload`, `getUrl`, `getContent`,
  `delete`.
- `FileRepository` — the `files` table (id, storageKey, contentType, byteSize,
  originalName, ownerId, visibility, metadata).
- `LocalDiskAdapter` (`STORAGE_ADAPTER`) — actually writes/reads bytes; the piece
  an S3 adapter replaces.
- Permission checks on the HTTP surface.

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
- HTTP (`/api/files`): `POST /` (multipart), `GET /:id`, `GET /:id/metadata`,
  `DELETE /:id`.

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

## 11. Example — adding an S3 adapter (future)

Implement `StorageAdapter` (put/get/delete by key), bind it to `STORAGE_ADAPTER`
via a config flag. `FileStorageService`, the `files` table, every controller, and
all of Mizan stay untouched.

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
