import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface PageChrome {
  title?: string;
  group?: string;
}

const PageChromeContext = createContext<{
  chrome: PageChrome;
  setChrome: (c: PageChrome) => void;
} | null>(null);

export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [chrome, setChrome] = useState<PageChrome>({});
  const value = useMemo(() => ({ chrome, setChrome }), [chrome]);
  return <PageChromeContext.Provider value={value}>{children}</PageChromeContext.Provider>;
}

/** A page calls this once to override the breadcrumb title/group the TopBar
 *  would otherwise derive from the current route via NAV. */
export function usePageChrome(chrome: PageChrome): void {
  const ctx = useContext(PageChromeContext);
  if (!ctx) throw new Error("usePageChrome must be used within <PageChromeProvider>");
  const { title, group } = chrome;
  useEffect(() => {
    ctx.setChrome({ title, group });
    return () => ctx.setChrome({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, group]);
}

export function useReadPageChrome(): PageChrome {
  const ctx = useContext(PageChromeContext);
  if (!ctx) throw new Error("useReadPageChrome must be used within <PageChromeProvider>");
  return ctx.chrome;
}
