import type { CurrentContext } from "../api/assistant.api";

/**
 * Derive the `currentContext` hint from the current route.
 *
 * This is a **disambiguation hint only** — the backend never trusts it for
 * authorization and rejects anything that isn't a real id / slug
 * (`assistant.schema.ts` is `.strict()`). We mirror that shape here so a
 * malformed URL segment simply drops the hint instead of making every chat
 * request fail validation.
 */
const ID_RE = /^[a-z]{2,6}_[A-Za-z0-9_-]{6,40}$/;
const SCREEN_RE = /^[a-z0-9/_-]{1,40}$/i;

export function contextFromPath(pathname: string): CurrentContext {
  const seg = pathname.split("/").filter(Boolean);
  const root = seg[0];

  if (root === "matters") {
    return seg[1] && ID_RE.test(seg[1])
      ? { screen: "matter", matterId: seg[1] }
      : { screen: "matter" };
  }
  if (root === "clients") {
    return seg[1] && ID_RE.test(seg[1])
      ? { screen: "client", clientId: seg[1] }
      : { screen: "client" };
  }
  if (root === "billing" && seg[1] === "invoices" && seg[2]) {
    return { screen: "invoice" };
  }
  return { screen: root && SCREEN_RE.test(root) ? root : "dashboard" };
}
