import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-8 w-full rounded-btn border border-border bg-surface px-2.5 text-[11.5px] text-foreground outline-none placeholder:text-placeholder focus-visible:border-primary",
          className,
        )}
        {...props}
      />
    );
  },
);

export function SearchInput({
  value,
  onChange,
  placeholder = "Filter rows…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-[190px] items-center gap-1.5 rounded-btn border border-border bg-surface-subtle px-2 py-1",
        className,
      )}
    >
      <Icon name="search" size={12} className="text-subtle" />
      <input
        type="search"
        value={value}
        aria-label={placeholder}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 flex-1 bg-transparent text-[11.5px] text-foreground outline-none placeholder:text-subtle [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  );
}
