import type { Route } from "@/presenters/context";

/**
 * Route names follow the approved design (`overview`, `projects`, `project`, `visit`, `inspect`, …).
 * The URL is simply `/<name>` or `/<name>/<id>`, so every screen is deep-linkable and survives reload.
 */
export function parseRoute(pathname: string): Route {
  const [n, id] = pathname.split("/").filter(Boolean);
  return { n: n ?? "overview", id: id ? decodeURIComponent(id) : null };
}

export function pathFor(n: string, id?: string | null): string {
  return id ? `/${n}/${encodeURIComponent(id)}` : `/${n}`;
}
