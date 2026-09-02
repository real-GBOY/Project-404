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
  HttpResponse.json({ code: "document.not_found", message: "Document not found." }, { status: 404 });

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

  // multipart in the real API → Core files; the mock accepts JSON or FormData.
  http.post("/api/documents", async ({ request }) => {
    let name = "Untitled.pdf";
    let matterId: string | null = null;
    let category = "Other";
    const ct = request.headers.get("content-type") ?? "";
    if (ct.includes("form")) {
      const fd = await request.formData();
      name = (fd.get("name") as string) || (fd.get("file") as File)?.name || name;
      matterId = (fd.get("matterId") as string) || null;
      category = (fd.get("category") as string) || category;
    } else {
      const b = (await request.json().catch(() => ({}))) as Record<string, string>;
      name = b.name ?? name;
      matterId = b.matterId ?? null;
      category = b.category ?? category;
    }
    const row: DocumentRow = {
      id: nextId("doc"),
      name,
      matterId,
      category,
      status: "draft",
      fileId: nextId("file"),
      sizeBytes: 120_000 + Math.floor(Math.random() * 400_000),
      mimeType: name.endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf",
      uploadedById: CURRENT_USER_ID,
      uploadedAt: new Date().toISOString(),
    };
    db.documents.unshift(row);
    if (matterId) {
      db.activity.unshift({
        id: nextId("act"),
        actorId: CURRENT_USER_ID,
        action: "document.uploaded",
        targetType: "document",
        targetId: row.id,
        targetLabel: row.name,
        at: new Date().toISOString(),
      });
    }
    return HttpResponse.json(view(row), { status: 201 });
  }),

  http.get("/api/documents/:id", ({ params }) => {
    const d = find(params.id as string);
    return d ? HttpResponse.json(view(d)) : notFound();
  }),

  http.patch("/api/documents/:id", async ({ params, request }) => {
    const d = find(params.id as string);
    if (!d) return notFound();
    const b = (await request.json()) as Partial<DocumentRow>;
    Object.assign(d, { name: b.name ?? d.name, category: b.category ?? d.category, status: b.status ?? d.status });
    return HttpResponse.json(view(d));
  }),

  http.delete("/api/documents/:id", ({ params }) => {
    db.documents = db.documents.filter((d) => d.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
