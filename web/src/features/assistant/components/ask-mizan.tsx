import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const SUGGESTED = [
  "assistant.prompts.upcoming_hearings",
  "assistant.prompts.overdue_tasks",
  "assistant.prompts.outstanding_invoices",
];

/**
 * Top-bar entry to the "Ask Mizan" assistant. F2 ships the drawer shell only —
 * the canned demo conversation is wired in F15 (PLAN decision #13: stub, no LLM,
 * clearly marked as a demonstration).
 */
export function AskMizan() {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t("assistant.open")}
        className="flex h-9 items-center gap-1.5 rounded-md border border-border-accent bg-surface-sand px-2.5 text-[12.5px] font-semibold text-link hover:bg-surface-sand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Icon name="auto_awesome" size={16} filled />
        <span className="hidden sm:inline">{t("assistant.name")}</span>
      </SheetTrigger>
      <SheetContent side="end" className="w-[min(30rem,100vw-2rem)]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>{t("assistant.name")}</SheetTitle>
            <Badge tone="warning" size="sm">
              {t("assistant.demo_badge")}
            </Badge>
          </div>
          <SheetDescription>{t("assistant.demo_note")}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-3">
          <p className="text-[12.5px] font-semibold text-muted">{t("assistant.try")}</p>
          <ul className="flex flex-col gap-2">
            {SUGGESTED.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  disabled
                  className="flex w-full items-start gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2.5 text-start text-[12.5px] text-foreground-body opacity-70"
                >
                  <Icon name="chat_bubble" size={15} className="mt-0.5 flex-none text-muted" />
                  {t(key)}
                </button>
              </li>
            ))}
          </ul>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
