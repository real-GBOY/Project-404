import type { QueryClient } from "@tanstack/react-query";
import type { Inspection } from "@/api/types";
import { offline } from "@/services/offline/session";
import type { Actions } from "@/presenters/actions";
import { setUi } from "@/state/ui-store";
import { QK, type QueryKeyName } from "../query-keys";

/** One slice of the application layer: a few commands that belong together. Slices are merged by `useActions`. */
export type Slice<K extends keyof Actions> = Pick<Actions, K>;
export type Qc = QueryClient;

/** Re-read the named server state on the screens that show it. */
export const invalidate = (qc: Qc, ...keys: QueryKeyName[]) =>
  Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));

/** Replace the cached inspection with what the server (or an optimistic edit) says, and keep a copy on the device for offline use. */
export function putInspection(qc: Qc, visitId: string, view: Inspection): void {
  qc.setQueryData([QK.inspection, visitId], view);
  void offline.cacheWrite(`inspection:${visitId}`, view);
  setUi({ savedAt: new Date().toTimeString().slice(0, 5) });
}
