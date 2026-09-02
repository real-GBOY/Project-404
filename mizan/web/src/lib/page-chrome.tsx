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
 *
 * Depends only on the (stable) `setChrome` — never on the store object, whose
 * identity changes on every update.
 */
export function useSetPageChrome(chrome: PageChrome) {
  const set = useContext(Ctx)?.set;
  const { title } = chrome;
  const count = chrome.count ?? null;
  const parentLabel = chrome.parent?.label ?? null;
  const parentTo = chrome.parent?.to ?? null;

  useEffect(() => {
    if (!set) return;
    set({
      title,
      count,
      parent: parentLabel && parentTo ? { label: parentLabel, to: parentTo } : null,
    });
    return () => set(null);
  }, [set, title, count, parentLabel, parentTo]);
}
