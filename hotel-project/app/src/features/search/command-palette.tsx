import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSearch } from "@/api/workspace";
import { cn } from "@/lib/cn";
import { useDebouncedValue } from "@/lib/use-debounced-value";

/**
 * The design's command palette (⌘K / Ctrl+K): one box to find guests, bookings, rooms, invoices
 * and tickets. The server only searches what the signed-in role may read. Arrow keys move,
 * Enter opens, Escape closes.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim(), 200);
  const results = useSearch(q);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const flat = useMemo(
    () => (q.length >= 2 ? (results.data ?? []).flatMap((g) => g.items) : []),
    [q, results.data],
  );
  useEffect(() => setActive(0), [q]);
  useEffect(() => input.current?.focus(), []);

  const open = (href: string) => {
    onClose();
    navigate(href);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && flat[active]) open(flat[active]!.href);
  };

  let index = -1;
  return (
    <div className="fixed inset-0 z-[100] flex justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close search"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-shadow"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative flex max-h-[440px] w-full max-w-[560px] flex-col overflow-hidden rounded-panel bg-surface shadow-popover"
      >
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls="palette-results"
          aria-label="Search guests, bookings, invoices, rooms"
          placeholder="Search guests, bookings, invoices, rooms…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          className="border-b border-border bg-surface px-5 py-4 text-[15px] outline-none placeholder:text-faint"
        />
        <div id="palette-results" role="listbox" className="overflow-y-auto p-2">
          {q.length < 2 ? (
            <p className="m-0 px-3 py-6 text-center text-small text-faint">
              Type at least two letters — a name, booking code, room or invoice number.
            </p>
          ) : results.isLoading ? (
            <p className="m-0 px-3 py-6 text-center text-small text-faint">Searching…</p>
          ) : flat.length === 0 ? (
            <p className="m-0 px-3 py-8 text-center text-small text-faint">No results</p>
          ) : (
            results.data!.map((group) => (
              <div key={group.key} role="group" aria-label={group.label} className="mb-1.5">
                <div className="px-3 pt-2 pb-1 text-micro font-bold text-faint uppercase">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  index++;
                  const selected = index === active;
                  const i = index;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      role="option"
                      aria-selected={selected}
                      tabIndex={-1}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => open(item.href)}
                      className={cn(
                        "block w-full cursor-pointer rounded-control px-3 py-[9px] text-left",
                        selected ? "bg-primary-soft" : "hover:bg-canvas",
                      )}
                    >
                      <div className="text-body font-semibold">{item.title}</div>
                      {item.subtitle ? (
                        <div className="text-label text-muted">{item.subtitle}</div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
