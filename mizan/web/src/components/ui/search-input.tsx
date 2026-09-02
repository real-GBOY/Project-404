import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** called with "" when the clear button is pressed */
  onClear?: () => void;
}

/** Text input with a leading search glyph and a clear affordance. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { className, value, onClear, "aria-label": ariaLabel, ...props },
  ref,
) {
  const { t } = useTranslation("common");
  const hasValue = value != null && String(value).length > 0;

  return (
    <div className={cn("relative flex items-center", className)} data-slot="search-input">
      <Icon
        name="search"
        size={16}
        className="pointer-events-none absolute start-2.5 text-subtle"
      />
      <input
        ref={ref}
        type="search"
        value={value}
        aria-label={ariaLabel ?? t("actions.search")}
        className={cn(
          "h-9 w-full rounded-md border border-border-control bg-surface ps-8 pe-8 text-[13px] text-foreground",
          "placeholder:text-subtle",
          "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={t("actions.cancel")}
          className="absolute end-1.5 flex size-6 items-center justify-center rounded-sm text-muted hover:bg-surface-subtle hover:text-foreground"
        >
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  );
});
