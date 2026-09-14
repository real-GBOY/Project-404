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

/** The "recommended action" style AI message — a tinted header (claim + detail) over a white
 *  footer with the recommendation copy and the run/decline/dismiss button row. Used by the
 *  Copilot chat for `ChatTurnFixture.isAction` turns and mirrors the design's dormant-leads card. */
export function ActionBubble({
  text,
  detail,
  recommend,
  cites,
  ctaLabel = "Create 23 follow-up tasks",
  secondaryLabel = "Review leads first",
  onAct,
  onDismiss,
}: {
  text: string;
  detail?: string;
  recommend?: string;
  cites?: string[];
  ctaLabel?: string;
  secondaryLabel?: string;
  onAct?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-sm bg-primary-surface text-primary">
        <Icon name="spark" size={13} />
      </span>
      <div className="min-w-0 flex-1 overflow-hidden rounded-chat border border-primary-border">
        <div className="border-b border-primary-border bg-primary-surface-pale px-3 py-2.5">
          <div className="text-[12.5px] font-semibold leading-snug text-pretty">{text}</div>
          {detail && <div className="mt-1 text-[11.5px] leading-relaxed text-body text-pretty">{detail}</div>}
        </div>
        <div className="bg-surface px-3 py-3">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted">Recommended action</div>
          {recommend && <div className="mt-1 text-[11.5px] leading-relaxed text-foreground text-pretty">{recommend}</div>}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onAct}
              className="rounded-btn bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary-hover"
            >
              {ctaLabel}
            </button>
            <button
              type="button"
              className="rounded-btn border border-border bg-surface px-2.5 py-1.5 text-[11px] hover:bg-canvas"
            >
              {secondaryLabel}
            </button>
            <button type="button" onClick={onDismiss} className="text-[11px] text-secondary hover:text-body">
              Dismiss
            </button>
            <div className="flex-1" />
            {cites?.map((c) => <CitationChip key={c} label={c} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
