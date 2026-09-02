import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

export interface CommandAction {
  id: string;
  label: string;
  /** group heading */
  group: string;
  icon?: string;
  keywords?: string[];
  perform: () => void;
}

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: CommandAction[];
}

/** ⌘K palette. Filter + arrow-key navigation + Enter to run. */
export function CommandMenu({ open, onOpenChange, actions }: CommandMenuProps) {
  const { t } = useTranslation("common");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) =>
      [a.label, a.group, ...(a.keywords ?? [])].join(" ").toLowerCase().includes(q),
    );
  }, [actions, query]);

  useEffect(() => setActive(0), [query, open]);

  const groups = useMemo(() => {
    const map = new Map<string, CommandAction[]>();
    for (const a of results) {
      const list = map.get(a.group) ?? [];
      list.push(a);
      map.set(a.group, list);
    }
    return [...map.entries()];
  }, [results]);

  function run(action: CommandAction | undefined) {
    if (!action) return;
    onOpenChange(false);
    setQuery("");
    action.perform();
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
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
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
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[1px]" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[15vh] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-sheet outline-none"
          onKeyDown={onKeyDown}
        >
          <DialogPrimitive.Title className="sr-only">{t("command.title")}</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-divider px-3">
            <Icon name="search" size={17} className="flex-none text-subtle" />
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus -- palette opens ready to type
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("command.placeholder")}
              className="h-11 w-full bg-transparent text-[13.5px] outline-none placeholder:text-subtle"
            />
          </div>
          <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
            {results.length === 0 && (
              <p className="px-2 py-8 text-center text-[12.5px] text-muted">
                {t("command.empty")}
              </p>
            )}
            {groups.map(([group, groupActions]) => (
              <div key={group} className="mb-1">
                <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-subtle">
                  {group}
                </div>
                {groupActions.map((action) => {
                  const index = results.indexOf(action);
                  return (
                    <button
                      key={action.id}
                      type="button"
                      data-index={index}
                      onMouseMove={() => setActive(index)}
                      onClick={() => run(action)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start text-[13px]",
                        index === active ? "bg-surface-subtle text-foreground" : "text-foreground-body",
                      )}
                    >
                      {action.icon && (
                        <Icon name={action.icon} size={16} className="flex-none text-muted" />
                      )}
                      {action.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
