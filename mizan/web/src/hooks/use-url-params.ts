import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * URL search params as the home for filters, active tab, and pagination
 * (ARCHITECTURE §5) — shareable and back-button safe. Empty / default values are
 * dropped from the URL so it stays clean.
 */
export function useUrlParams<K extends string>(defaults: Partial<Record<K, string>> = {}) {
  const [search, setSearch] = useSearchParams();

  const get = useCallback(
    (key: K): string | undefined => search.get(key) ?? defaults[key],
    [search, defaults],
  );

  const getNumber = useCallback(
    (key: K, fallback: number): number => {
      const raw = search.get(key);
      const n = raw == null ? NaN : Number(raw);
      return Number.isFinite(n) ? n : fallback;
    },
    [search],
  );

  const set = useCallback(
    (patch: Partial<Record<K, string | number | null | undefined>>, opts?: { resetPage?: boolean }) => {
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === "" || value === defaults[key as K]) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }
          if (opts?.resetPage) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setSearch, defaults],
  );

  return useMemo(() => ({ get, getNumber, set }), [get, getNumber, set]);
}
