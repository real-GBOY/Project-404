import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";
import type { Route } from "@/presenters/context";
import { QK } from "../query-keys";

/**
 * The confidential area's queries depend on what the backend says this person may do (an officer with a grant, or the General
 * Manager, and only inside a logged session), so that is asked first and the rest follow from the answer.
 */
export function useConfidentialAccess(route: Route) {
  const conf = route.n === "confidential";
  const accessQ = useQuery({
    queryKey: [QK.confAccess],
    queryFn: () => api.conf.access(),
    enabled: conf,
    staleTime: 5_000,
    refetchInterval: conf ? 30_000 : false,
  });
  const access = accessQ.data;
  const inSession = !!access?.sessionUntil && Date.parse(access.sessionUntil) > Date.now();
  return {
    conf,
    access,
    pending: conf && accessQ.isPending,
    officer: conf && !!access?.grant && inSession,
    gm: conf && !!access?.isGM && !access?.grant && inSession,
  };
}
