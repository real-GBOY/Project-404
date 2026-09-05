import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * There is no time-entry endpoint in the backend at all (confirmed — not a
 * missing mobile surface, the feature doesn't exist server-side). Rather than
 * fake a server round-trip, "Save time entry" writes to this on-device queue
 * and the screen says so plainly. When a real endpoint ships, this queue is
 * what a sync job would drain.
 */
const KEY = "mizan.pending-time-entries";
const queryKey = ["time-entries", "pending"];

export interface PendingTimeEntry {
  id: string;
  matterId: string;
  matterReference: string;
  matterTitle: string;
  activity: string;
  narrative: string;
  seconds: number;
  billable: boolean;
  hourlyRate: number | null;
  currency: string;
  createdAt: string;
}

async function read(): Promise<PendingTimeEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingTimeEntry[]) : [];
  } catch {
    return [];
  }
}

export function usePendingTimeEntries() {
  return useQuery({ queryKey, queryFn: read });
}

export function useSaveTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: Omit<PendingTimeEntry, "id" | "createdAt">) => {
      const list = await read();
      const record: PendingTimeEntry = {
        ...entry,
        id: `local-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(KEY, JSON.stringify([record, ...list]));
      return record;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });
}
