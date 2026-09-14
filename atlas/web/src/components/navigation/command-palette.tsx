import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "@/app/router/nav";
import { Icon } from "@/components/ui/icon";

export interface CommandResult {
  id: string;
  group: string;
  title: string;
  sub?: string;
  meta?: string;
  icon?: string;
  perform: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** entity search results (units/customers/leads/projects/contracts/documents), supplied by the app shell */
  search?: (query: string) => CommandResult[];
}

/** Global ⌘K palette — navigation actions plus (when `search` is supplied) a
 *  live omnisearch across units, customers, leads, projects, contracts &
 *  payments, and documents. */
export function CommandPalette({ open, onOpenChange, search }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const navResults = useMemo<CommandResult[]>(
    () =>
      NAV_ITEMS.map((item) => ({
        id: `nav:${item.to}`,
        group: "Navigate",
        title: item.label,
        perform: () => navigate(item.to),
      })),
    [navigate],
  );

  const results = useMemo<CommandResult[]>(() => {
    const q = query.trim().toLowerCase();
    const entityResults = q && search ? search(q) : [];
    const filteredNav = !q
      ? navResults
      : navResults.filter((r) => r.title.toLowerCase().includes(q));
    return [...entityResults, ...filteredNav];
  }, [query, search, navResults]);

  useEffect(() => setActive(0), [query, open]);

  const groups = useMemo(() => {
    const map = new Map<string, CommandResult[]>();
    for (const r of results) {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    }
    return [...map.entries()];
  }, [results]);

  function run(result: CommandResult | undefined) {
    if (!result) return;
    onOpenChange(false);
    setQuery("");
    result.perform();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[active]);
    }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-40 bg-[rgba(11,11,12,.35)]"
          style={{ animation: "fadein .15s ease" }}
        />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[9vh] z-50 w-[620px] max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-modal border border-border-elevated bg-surface outline-none"
          style={{ animation: "slidein .16s ease", boxShadow: "var(--shadow-modal)" }}
          onKeyDown={onKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">Search everything</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-border px-3.5">
            <Icon name="search" size={14} className="flex-none text-subtle" />
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus -- palette opens ready to type
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search units, customers, leads, projects, contracts, documents…"
              className="h-11 w-full bg-transparent text-[13px] outline-none placeholder:text-subtle"
            />
            <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[9px] text-subtle">ESC</span>
          </div>
          <div ref={listRef} className="max-h-[420px] overflow-y-auto p-1.5">
            {results.length === 0 && (
              <p className="px-2 py-10 text-center text-[12px] text-muted">
                Nothing indexed for “{query}”.
              </p>
            )}
            {groups.map(([group, groupResults]) => (
              <div key={group} className="mb-1">
                <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.09em] text-subtle">
                  {group}
                </div>
                {groupResults.map((r) => {
                  const index = results.indexOf(r);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      data-index={index}
                      onMouseMove={() => setActive(index)}
                      onClick={() => run(r)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-start text-[12px]",
                        index === active ? "bg-primary-surface-pale text-foreground" : "text-body",
                      )}
                    >
                      {r.icon && (
                        <span className="flex size-[22px] flex-none items-center justify-center rounded-sm bg-primary-surface text-primary">
                          <Icon name={r.icon} size={13} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.title}</span>
                        {r.sub && <span className="block truncate text-[10.5px] text-subtle">{r.sub}</span>}
                      </span>
                      {r.meta && <span className="flex-none font-mono text-[10px] text-subtle">{r.meta}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 border-t border-border bg-surface-subtle px-3.5 py-2 text-[9.5px] text-subtle">
            <span className="flex items-center gap-1">
              <span className="rounded-sm border border-border px-1 font-mono">↑↓</span> navigate
            </span>
            <span className="flex items-center gap-1">
              <span className="rounded-sm border border-border px-1 font-mono">↵</span> open
            </span>
            <div className="flex-1" />
            <span className="flex items-center gap-1">
              <span className="rounded-sm border border-border px-1 font-mono">⌘K</span> toggle
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
