import { http } from "@/services/http";

/**
 * Download a file the API protects (a CSV export). The browser cannot attach the bearer token to a plain link, so this fetches with the
 * token, then hands the bytes to the browser as a download, named by the server (`Content-Disposition`).
 */
export async function downloadProtected(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(http.withApiBase(path), { headers: http.bearerHeaders() });
  if (!res.ok) {
    let message = `The export failed (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  const name =
    /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
