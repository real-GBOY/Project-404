import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, ENDPOINTS, http } from "@/config";

// ─── ⌘K search ──────────────────────────────────────────────────────────────

export interface SearchGroup {
  key: string;
  label: string;
  items: Array<{ id: string; title: string; subtitle: string | null; href: string }>;
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ["search", q],
    queryFn: async () =>
      (await http<{ groups: SearchGroup[] }>(ENDPOINTS.search, { query: { q } })).groups,
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

// ─── notifications (Core's inbox) ─────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: { href?: string } | null;
  read: boolean;
  createdAt: string;
}

export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      http<{ notifications: AppNotification[]; unreadCount: number }>(
        ENDPOINTS.notifications.list,
        { query: { limit: "20" } },
      ),
    enabled,
    refetchInterval: 60_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | "all") =>
      http(id === "all" ? ENDPOINTS.notifications.readAll : ENDPOINTS.notifications.read(id), {
        method: "POST",
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

// ─── activity (audit feed) ────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  actorName: string;
  verb: string;
  subject: string | null;
  href: string | null;
  detail: string | null;
  action: string;
  severity: "info" | "warning";
  at: string;
}

export function useActivity(cursor: string | undefined) {
  return useQuery({
    queryKey: ["activity", cursor ?? "first"],
    queryFn: () =>
      http<{ items: ActivityItem[]; nextCursor: string | null }>(ENDPOINTS.activity, {
        query: { cursor, limit: "50" },
      }),
  });
}

// ─── guest documents (files held by Core) ─────────────────────────────────────

export interface GuestDocument {
  id: string;
  fileId: string;
  kind: "id_document" | "other";
  label: string | null;
  fileName: string | null;
  contentType: string | null;
  byteSize: number | null;
  uploadedByName: string | null;
  createdAt: string;
}

const docKeys = (guestId: string) => ["guest-documents", guestId] as const;

export function useGuestDocuments(guestId: string, enabled: boolean) {
  return useQuery({
    queryKey: docKeys(guestId),
    queryFn: async () =>
      (await http<{ items: GuestDocument[] }>(ENDPOINTS.documents.list(guestId))).items,
    enabled,
  });
}

interface PresignedUpload {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

/**
 * Upload the bytes through Core's files module (presign → PUT straight to storage → confirm),
 * then link the stored file to the guest. The upload isn't attached until every step succeeds.
 */
export function useUploadGuestDocument(guestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      file: File;
      kind: GuestDocument["kind"];
      label: string | null;
    }) => {
      const { fileId, upload } = await http<{ fileId: string; upload: PresignedUpload }>(
        ENDPOINTS.files.uploads,
        {
          method: "POST",
          body: {
            originalName: input.file.name,
            contentType: input.file.type || "application/octet-stream",
            byteSize: input.file.size,
          },
        },
      );
      await putToStorage(upload, input.file);
      await http(ENDPOINTS.files.confirm(fileId), { method: "POST" });
      return http<{ id: string }>(ENDPOINTS.documents.list(guestId), {
        method: "POST",
        body: { fileId, kind: input.kind, label: input.label },
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: docKeys(guestId) }),
  });
}

export function useRemoveGuestDocument(guestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http(ENDPOINTS.documents.remove(guestId, id), { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: docKeys(guestId) }),
  });
}

async function putToStorage(upload: PresignedUpload, blob: Blob): Promise<void> {
  const isAbsolute = /^https?:\/\//i.test(upload.url);
  const headers: Record<string, string> = { ...upload.headers };
  if (!isAbsolute) {
    // The local driver's loopback route is our own API: it needs the bearer token and a raw
    // octet-stream body (a Blob would otherwise carry its own MIME type).
    Object.assign(headers, http.bearerHeaders());
    headers["Content-Type"] = "application/octet-stream";
  }
  const res = await fetch(http.withApiBase(upload.url), {
    method: upload.method,
    headers,
    body: blob,
  });
  if (!res.ok) {
    throw new ApiError(res.status, { code: "upload.failed", message: "The file upload failed." });
  }
}

/** Open a stored file in a new tab (fetched with the staff member's credentials). */
export async function openStoredFile(fileId: string): Promise<void> {
  const get = () =>
    fetch(http.withApiBase(ENDPOINTS.files.content(fileId)), { headers: http.bearerHeaders() });
  let res = await get();
  if (res.status === 401 && (await http.refresh())) res = await get();
  if (!res.ok) {
    throw new ApiError(res.status, { code: "download.failed", message: "Couldn't open the file." });
  }
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
