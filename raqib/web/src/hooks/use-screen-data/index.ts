import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import type { Me } from "@/api/types";
import type { Denial } from "@/presenters/build";
import type { Data, Route } from "@/presenters/context";
import { analyticsQuery } from "@/presenters/screens/analytics";
import { auditQuery } from "@/presenters/screens/audit";
import type { UiState } from "@/state/ui-store";
import { deriveDenial } from "./denial";
import { screenNeeds } from "./needs";
import { NON_BLOCKING, queryDefs } from "./queries";
import { useConfidentialAccess } from "./use-confidential-access";

export interface ScreenData {
  data: Data;
  pending: boolean;
  denial: Denial | null;
  error: Error | null;
  retry: () => void;
}

/**
 * The server state the current screen needs, as one `Data` object for the presenters. Each resource is its own TanStack Query
 * (server state stays out of any global store); see `needs.ts` for what is wanted, `queries.ts` for how it is fetched.
 */
export function useScreenData(route: Route, me: Me, ui: UiState): ScreenData {
  const want = screenNeeds(route, me);
  const confidential = useConfidentialAccess(route);
  const scheduling = !!ui.modal && ["create", "resched"].includes(ui.modal.kind);
  const defs = queryDefs({
    route,
    me,
    ui,
    want,
    analytics: analyticsQuery({ ui } as never),
    audit: auditQuery({ ui } as never),
    conf: confidential,
    inspectors: {
      project: scheduling ? String(ui.mf.p ?? "") : "",
      date: String(ui.mf.date ?? me.today) || me.today,
    },
  });
  const results = useQueries({
    queries: defs.map((d) => ({
      queryKey: [d.key, ...(("extra" in d && d.extra) || [])],
      queryFn: d.fn,
      enabled: d.enabled,
      staleTime: 15_000,
      refetchInterval: ("refetch" in d && d.refetch) || false,
    })),
  }) as UseQueryResult<unknown>[];

  const data: Data = {};
  if (confidential.access) data.confAccess = confidential.access;
  defs.forEach((d, idx) => {
    const r = results[idx]!;
    if (r.data !== undefined) (data as Record<string, unknown>)[d.key] = r.data;
  });

  const pending =
    confidential.pending ||
    defs.some((d, idx) => d.enabled && !NON_BLOCKING.has(d.key) && results[idx]!.isPending);
  // only a query this screen wants can fail it: a disabled query still reports the error it cached earlier
  const error =
    (results.find((r, idx) => defs[idx]!.enabled && r.error)?.error as Error | undefined) ?? null;
  const denial = deriveDenial(route, data, error, pending);
  return {
    data,
    pending,
    denial,
    error: denial ? null : error,
    retry: () => results.forEach((r) => void r.refetch()),
  };
}
