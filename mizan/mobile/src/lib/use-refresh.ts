import { useState } from "react";

/** Wire one or more query `refetch` fns to a `<RefreshControl>`. */
export function useRefresh(...refetchers: Array<() => Promise<unknown>>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all(refetchers.map((r) => r().catch(() => undefined)));
    } finally {
      setRefreshing(false);
    }
  };
  return { refreshing, onRefresh };
}
