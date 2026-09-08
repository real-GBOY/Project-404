import { http, HttpResponse } from "msw";
import {
  CURRENT_USER_ID,
  db,
  matterRef,
  matterTitle,
  nextId,
  userName,
  type DocumentRow,
} from "../fixtures/db";

const find = (id: string) => db.documents.find((d) => d.id === id);
const notFound = () =>
  HttpResponse.json(
    { code: "document.not_found", message: "Document not found." },
    { status: 404 },
  );

/** Tracks presigned uploads between the reserve, PUT-bytes, and confirm steps. */
const pendingUploads = new Map<
  string,
  { docId: string; matterId: string | null; uploaded: boolean }
>();

function recordUploadActivity(d: DocumentRow) {
  db.activity.unshift({
    id: nextId("act"),
    actorId: CURRENT_USER_ID,
    action: "document.uploaded",
    targetType: "document",
    targetId: d.id,
    targetLabel: d.name,
    at: new Date().toISOString(),
  });
}

const view = (d: DocumentRow) => ({
  id: d.id,
  name: d.name,
  matterId: d.matterId,
  matterTitle: matterTitle(d.matterId),
  matterReference: matterRef(d.matterId),
  category: d.category,
  status: d.status,
  sizeBytes: d.sizeBytes,
  mimeType: d.mimeType,
  uploadedBy: userName(d.uploadedById),
  uploadedAt: d.uploadedAt,
});

export const documentHandlers = [
  http.get("/api/documents/summary", () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return HttpResponse.json({
      total: db.documents.length,
      awaitingReview: db.documents.filter((d) => d.status === "draft").length,
      expiring: db.documents.filter((d) =>
        `${d.category} ${d.name}`.toLowerCase().match(/power|authority|attorney/),
      ).length,
      addedThisMonth: db.documents.filter(
        (d) => new Date(d.uploadedAt).getTime() >= monthStart.getTime(),
      ).length,
    });
  }),

  http.get("/api/documents", ({ request }) => {
    const url = new URL(request.url);
    const matterId = url.searchParams.get("matterId");
    const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");

    let rows = [...db.documents];
    if (matterId) rows = rows.filter((d) => d.matterId === matterId);
    if (category && category !== "all") rows = rows.filter((d) => d.category === category);
    if (status && status !== "all") rows = rows.filter((d) => d.status === status);
    if (q) rows = rows.filter((d) => d.name.toLowerCase().includes(q));
    rows.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    return HttpResponse.json({ items: rows.map(view), total: rows.length });
  }),

  // Presigned upload: reserve the row + a pending file, hand back an upload URL.
  // The real API also still accepts multipart / metadata-only JSON; the mock
  // covers JSON (presign + metadata-only) and FormData.
  http.post("/api/documents", async ({ request }) => {
    let name = "Untitled.pdf";
    let matterId: string | null = null;
    let category = "Other";
    let contentType: string | null = null;
    let byteSize: number | null = null;
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("form")) {
      const fd = await request.formData();
      name = (fd.get("name") as string) || (fd.get("file") as File)?.name || name;
      matterId = (fd.get("matterId") as string) || null;
      category = (fd.get("category") as string) || category;
    } else {
      const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      name = (b.name as string) ?? name;
      matterId = (b.matterId as string) ?? null;
      category = (b.category as string) ?? category;
      contentType = (b.contentType as string) ?? null;
      byteSize = typeof b.byteSize === "number" ? b.byteSize : null;
    }

    const presigned = contentType !== null && byteSize !== null;
    const fileId = nextId("file");
    const row: DocumentRow = {
      id: nextId("doc"),
      name,
      matterId,
      category,
      status: "draft",
      fileId,
      sizeBytes: presigned ? byteSize! : 120_000 + Math.floor(Math.random() * 400_000),
      mimeType:
        contentType ??
        (name.endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf"),
      uploadedById: CURRENT_USER_ID,
      uploadedAt: new Date().toISOString(),
    };
    db.documents.unshift(row);

    if (presigned) {
      pendingUploads.set(fileId, { docId: row.id, matterId, uploaded: false });
      return HttpResponse.json(
        {
          document: view(row),
          upload: {
            url: `/_test-upload/${fileId}`,
            method: "PUT",
            headers: {},
            expiresAt: new Date(Date.now() + 900_000).toISOString(),
          },
        },
        { status: 201 },
      );
    }

    // metadata-only / multipart path — immediately "uploaded".
    if (matterId) recordUploadActivity(row);
    return HttpResponse.json(view(row), { status: 201 });
  }),

  // Stand-in for the direct PUT to storage (R2 presigned URL / local loopback).
  http.put("/api/_test-upload/:fileId", async ({ params }) => {
    const pending = pendingUploads.get(params.fileId as string);
    if (!pending) return new HttpResponse(null, { status: 404 });
    pending.uploaded = true;
    return new HttpResponse(null, { status: 204 });
  }),

  // Confirm — the real API HEADs the object; the mock checks the PUT happened.
  http.post("/api/documents/:id/confirm", ({ params }) => {
    const d = find(params.id as string);
    if (!d) return notFound();
    const pending = pendingUploads.get(d.fileId);
    if (!pending?.uploaded) {
      return HttpResponse.json(
        { code: "files.upload_missing", message: "No uploaded object was found." },
        { status: 400 },
      );
    }
    pendingUploads.delete(d.fileId);
    if (d.matterId) recordUploadActivity(d);
    return HttpResponse.json({ document: view(d) });
  }),

  http.get("/api/documents/:id", ({ params }) => {
    const d = find(params.id as string);
    return d ? HttpResponse.json(view(d)) : notFound();
  }),

  http.patch("/api/documents/:id", async ({ params, request }) => {
    const d = find(params.id as string);
    if (!d) return notFound();
    const b = (await request.json()) as Partial<DocumentRow>;
    Object.assign(d, {
      name: b.name ?? d.name,
      category: b.category ?? d.category,
      status: b.status ?? d.status,
    });
    return HttpResponse.json(view(d));
  }),

  http.delete("/api/documents/:id", ({ params }) => {
    db.documents = db.documents.filter((d) => d.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
