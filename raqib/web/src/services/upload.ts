import { API_BASE_URL, tokenStore } from "@/config";

export interface PresignResponse {
  fileId: string;
  upload: { url: string; method: "PUT"; headers: Record<string, string>; expiresAt: string };
}

/**
 * Send the bytes to the presigned target with real progress. A local-driver target is an API path (needs the bearer
 * token); an R2 target is an absolute URL the browser PUTs to directly (no API credentials sent to storage).
 */
export function putWithProgress(file: File, upload: PresignResponse["upload"], onProgress: (pct: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const absolute = /^https?:\/\//i.test(upload.url);
    xhr.open("PUT", absolute ? upload.url : `${API_BASE_URL}${upload.url}`);
    for (const [k, v] of Object.entries(upload.headers)) xhr.setRequestHeader(k, v);
    if (!absolute) {
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      const access = tokenStore.getAccess();
      if (access) xhr.setRequestHeader("Authorization", `Bearer ${access}`);
    } else if (!("Content-Type" in upload.headers)) {
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}

export const evidenceKindOf = (mime: string): "photo" | "video" | "doc" => (mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "photo" : "doc");
