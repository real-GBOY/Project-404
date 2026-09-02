import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { Icon } from "./icon";
import { IconButton } from "./icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerProps {
  /** ISO date string `YYYY-MM-DD` or null */
  value: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  "aria-describedby"?: string;
  className?: string;
}

const ISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Month-grid date picker on a Popover. Locale-aware weekday/month labels. */
export function DatePicker({
  value,
  onValueChange,
  placeholder,
  min,
  max,
  disabled,
  invalid,
  id,
  "aria-describedby": describedBy,
  className,
}: DatePickerProps) {
  const { t, i18n } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const [view, setView] = useState(() => selected ?? new Date());

  const locale = `${(i18n.resolvedLanguage ?? "ar").split("-")[0]}-EG`;
  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(view);

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(new Date(2023, 0, 1 + i)),
  );

  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1),
    ),
  ];

  const outOfRange = (d: Date) => (min && ISO(d) < min) || (max && ISO(d) > max);
  const todayIso = ISO(new Date());

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <span>{selected ? formatDate(selected) : (placeholder ?? t("actions.search"))}</span>
          <Icon name="calendar_today" size={15} className="flex-none text-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="mb-2 flex items-center justify-between">
          <IconButton
            icon="chevron_left"
            aria-label={t("pagination.previous")}
            size="sm"
            className="rtl:rotate-180"
            onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          />
          <span className="text-[12.5px] font-bold text-foreground">{monthLabel}</span>
          <IconButton
            icon="chevron_right"
            aria-label={t("pagination.next")}
            size="sm"
            className="rtl:rotate-180"
            onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          />
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {weekdays.map((w, i) => (
            <div key={i} className="py-1 text-center text-[10.5px] font-semibold text-subtle">
              {w}
            </div>
          ))}
          {cells.map((d, i) =>
            d === null ? (
              <div key={`e-${i}`} />
            ) : (
              <button
                key={ISO(d)}
                type="button"
                disabled={!!outOfRange(d)}
                aria-current={ISO(d) === todayIso ? "date" : undefined}
                aria-pressed={value === ISO(d)}
                onClick={() => {
                  onValueChange(ISO(d));
                  setOpen(false);
                }}
                className={cn(
                  "flex h-8 items-center justify-center rounded-md text-[12.5px] transition-colors",
                  "hover:bg-surface-subtle disabled:pointer-events-none disabled:opacity-30",
                  value === ISO(d)
                    ? "bg-primary font-bold text-primary-foreground hover:bg-primary-hover"
                    : ISO(d) === todayIso
                      ? "font-bold text-primary"
                      : "text-foreground-body",
                )}
              >
                {d.getDate()}
              </button>
            ),
          )}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => {
              onValueChange(null);
              setOpen(false);
            }}
            className="mt-2 w-full rounded-md py-1.5 text-[12px] font-semibold text-muted hover:bg-surface-subtle"
          >
            {t("actions.cancel")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
