import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export interface ComboboxOption {
  value: string;
  label: string;
  /** secondary line under the label */
  hint?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  /** shown in the filter box */
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  "aria-describedby"?: string;
  className?: string;
}

/** Single-select typeahead — filter + keyboard, built on Popover. */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  invalid,
  id,
  "aria-describedby": describedBy,
  className,
}: ComboboxProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border-control bg-surface px-3 text-[13px]",
            selected ? "text-foreground" : "text-subtle",
            "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            invalid && "border-danger",
            className,
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder ?? t("actions.search")}</span>
          <Icon name="unfold_more" size={16} className="flex-none text-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center gap-2 border-b border-divider px-2.5">
          <Icon name="search" size={15} className="flex-none text-subtle" />
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- focus the filter when the popover opens
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder ?? t("actions.search")}
            className="h-9 w-full bg-transparent text-[13px] outline-none placeholder:text-subtle"
          />
        </div>
        <ul role="listbox" className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <li className="px-2 py-6 text-center text-[12.5px] text-muted">
              {emptyText ?? t("states.empty_title")}
            </li>
          )}
          {filtered.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onValueChange(isSelected ? null : opt.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-start text-[13px] hover:bg-surface-subtle",
                    isSelected && "font-semibold",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{opt.label}</span>
                    {opt.hint && <span className="block truncate text-[11px] text-muted">{opt.hint}</span>}
                  </span>
                  {isSelected && <Icon name="check" size={15} className="flex-none text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
