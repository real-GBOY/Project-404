import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Icon } from "@/components/ui/icon";

export interface FilterDropdownProps {
  /** e.g. "Status" — shown as "Status: All" or "Status: Qualified". */
  label: string;
  value: string;
  /** Includes "All" as the reset option. */
  options: string[];
  onChange: (value: string) => void;
}

/** A single-select filter — the toolbar trigger + its option list, over real
 *  values (usually the distinct values a column actually has right now). */
export function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-btn border border-border bg-surface px-2.5 py-1 text-[11px] text-body transition-colors hover:bg-canvas data-[state=open]:bg-canvas"
        >
          {label}: {value} <span className="text-[9px] text-subtle">▾</span>
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={4}
          className="z-50 max-h-64 min-w-[168px] overflow-y-auto overflow-x-hidden rounded-btn border border-border-elevated bg-surface py-1 outline-none"
          style={{ animation: "slidein .12s ease", boxShadow: "var(--shadow-elevated)" }}
        >
          {options.map((opt) => (
            <DropdownMenuPrimitive.Item
              key={opt}
              onSelect={() => onChange(opt)}
              className="flex cursor-pointer items-center justify-between gap-3 px-2.5 py-1.5 text-[11.5px] text-body outline-none transition-colors hover:bg-canvas data-[highlighted]:bg-canvas"
            >
              <span className="truncate">{opt}</span>
              {opt === value && <Icon name="check" size={12} className="shrink-0 text-primary" />}
            </DropdownMenuPrimitive.Item>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
