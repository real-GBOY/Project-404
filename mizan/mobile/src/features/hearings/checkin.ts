import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * "Check in at court" has no backend endpoint (confirmed absent) — this
 * records the check-in locally on the device and is presented as exactly
 * that, not a synced state.
 */
const key = (hearingId: string) => `mizan.hearing-checkin.${hearingId}`;

export function useCheckIn(hearingId: string) {
  const qc = useQueryClient();
  const queryKey = ["hearing-checkin", hearingId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const v = await AsyncStorage.getItem(key(hearingId));
      return v ?? null;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      await AsyncStorage.setItem(key(hearingId), now);
      return now;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return { checkedInAt: query.data ?? null, checkIn: mutation };
}
