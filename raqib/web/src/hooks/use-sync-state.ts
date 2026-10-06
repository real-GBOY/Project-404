import { useSyncExternalStore } from "react";
import { offline, type SyncState } from "@/services/offline/session";

/** Connectivity and the offline queue's state (online, changes waiting, changes refused, syncing), live. */
export function useSyncState(): SyncState {
  return useSyncExternalStore(offline.subscribe, offline.getSnapshot, offline.getSnapshot);
}
