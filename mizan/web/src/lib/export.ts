/**
 * Client-side file exports. The backend has no report endpoints yet, so these
 * build the file in the browser from data already loaded into the page and hand
 * it to the user as a download.
 */
import { tokenStore } from "@/lib/auth/token-store";
import { ApiError } from "@/lib/api/api-error";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Download `rows` as a CSV file. Columns are taken from `columns` (order + header). */
export function downloadCsv<T>(
  filename: string,
  columns: { key: keyof T; header: string }[],
  rows: T[],
): void {
  const head = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows
    .map((r) => columns.map((c) => csvCell((r as Record<string, unknown>)[c.key as string])).join(","))
    .join("\n");
  // BOM so Excel opens UTF-8 (Arabic) correctly.
  const blob = new Blob(["﻿", head, "\n", body], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/** Timestamp suffix for export filenames, e.g. `2026-09-04`. */
export function exportStamp(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch a binary endpoint with the bearer token and save the response as a file.
 * Used for attachment routes (`.../download`) that can't go through `httpClient`
 * (which parses JSON) and can't be a plain `<a href>` (no cookie auth).
 */
export async function downloadFromApi(path: string, fallbackName: string): Promise<void> {
  const token = tokenStore.getAccess();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let body: Record<string, unknown> | null = null;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, body);
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;
  triggerDownload(await res.blob(), filename);
}
