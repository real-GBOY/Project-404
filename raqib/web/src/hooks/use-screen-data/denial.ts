import type { Denial } from "@/presenters/build";
import type { Data, Route } from "@/presenters/context";
import { ApiError } from "@/services/http";

/**
 * Why a screen cannot be shown, if it cannot: the backend refused it (403), or the record is not among the (scope-filtered)
 * ones the person can read, which means it is outside their scope or gone.
 */
export function deriveDenial(
  route: Route,
  data: Data,
  error: Error | null,
  pending: boolean,
): Denial | null {
  if (error instanceof ApiError && error.isForbidden) {
    return {
      k: error.code === "raqib.out_of_scope" ? "scope" : "module",
      res: route.id ?? route.n,
    };
  }
  if (pending || error) return null;
  const missing = (list: Array<{ id: string }> | undefined) =>
    !!list && !list.some((x) => x.id === route.id);
  const outside =
    (route.n === "project" && missing(data.projects)) ||
    (["visit", "review", "inspect", "report"].includes(route.n) && missing(data.visits)) ||
    (route.n === "user" && missing(data.users));
  return outside ? { k: "scope", res: route.id ?? "" } : null;
}
