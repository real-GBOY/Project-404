import { useEffect, useState } from "react";

/** Debounces a fast-changing value (keystrokes) before it drives a network
 *  request — search is now backend-driven, so every keystroke would otherwise
 *  fire its own request. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
