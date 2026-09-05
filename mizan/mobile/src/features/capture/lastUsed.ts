import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";

/** The "Last used · <matter>" hint on the Quick Capture sheet. */
const KEY = "mizan.capture-last-matter";
const queryKey = ["capture", "last-matter"];

export interface LastUsedMatter {
  id: string;
  reference: string;
  title: string;
}

export function useLastUsedMatter() {
  return useQuery({
    queryKey,
    queryFn: async (): Promise<LastUsedMatter | null> => {
      const raw = await AsyncStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as LastUsedMatter) : null;
    },
  });
}

export function useSetLastUsedMatter() {
  const qc = useQueryClient();
  return async (matter: LastUsedMatter) => {
    await AsyncStorage.setItem(KEY, JSON.stringify(matter));
    qc.invalidateQueries({ queryKey });
  };
}
