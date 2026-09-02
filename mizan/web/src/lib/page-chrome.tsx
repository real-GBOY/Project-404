import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface PageChrome {
  /** shown in the top bar as the page title (17px / 800) */
  title: string;
  /** count pill after the title */
  count?: string | number | null;
  /** breadcrumb parent shown before the title */
  parent?: { label: string; to: string } | null;
}

interface ChromeStore {
  chrome: PageChrome | null;
  set: (c: PageChrome | null) => void;
}

const Ctx = createContext<ChromeStore | null>(null);

export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<PageChrome | null>(null);
  const value = useMemo<ChromeStore>(() => ({ chrome, set: setChrome }), [chrome]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Read the current page chrome (top bar). */
export function usePageChrome(): PageChrome | null {
  return useContext(Ctx)?.chrome ?? null;
}

/**
 * Declare this page's top-bar title / count / breadcrumb. Cleared on unmount so
 * the next route falls back to its nav-derived default.
 */
export function useSetPageChrome(chrome: PageChrome) {
  const store = useContext(Ctx);
  const { title, count, parent } = chrome;
  const parentLabel = parent?.label ?? null;
  const parentTo = parent?.to ?? null;

  useEffect(() => {
    if (!store) return;
    store.set({
      title,
      count: count ?? null,
      parent: parentLabel && parentTo ? { label: parentLabel, to: parentTo } : null,
    });
    return () => store.set(null);
  }, [store, title, count, parentLabel, parentTo]);
}
