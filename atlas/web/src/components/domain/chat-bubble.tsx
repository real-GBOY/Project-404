import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] rounded-chat bg-foreground px-3 py-2 text-[12.5px] text-white">{text}</div>
    </div>
  );
}

/** The AI bubble is a superset "canvas" — it can carry a stats strip, a table,
 *  citations, and follow-up pills, not just text. */
export function AiBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-sm bg-primary-surface text-primary">
        <Icon name="spark" size={13} />
      </span>
      <div className="flex max-w-[86%] flex-col gap-2 rounded-chat border border-border bg-surface px-3 py-2.5">
        {children}
      </div>
    </div>
  );
}

export function CitationChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-primary-border bg-primary-surface-pale px-1.5 py-0.5 text-[10px] text-primary">
      <Icon name="doc" size={10} />
      {label}
    </span>
  );
}

export function FollowUpPill({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-pill border border-border bg-surface px-2.5 py-1 text-[10.5px] text-body transition-colors hover:border-primary hover:text-primary"
    >
      {label}
    </button>
  );
}
