import type { ReactNode } from "react";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import type { Tone } from "@/lib/tone";

export interface AiInsight {
  id: string;
  tag: string;
  tagTone: Tone;
  confidence: string;
  text: string;
  detail: string;
  cta: string;
}

export function InsightCard({
  insight,
  onAct,
  onDismiss,
  sidebar,
}: {
  insight: AiInsight;
  onAct?: () => void;
  onDismiss?: () => void;
  /** when present, renders the wide "Feed" skin with a right-hand action sidebar instead of inline buttons */
  sidebar?: ReactNode;
}) {
  const body = (
    <div className="flex flex-1 flex-col gap-2 p-3">
      <div className="flex items-center gap-1.5">
        <Pill tone={insight.tagTone}>{insight.tag}</Pill>
        <span className="font-mono text-[9.5px] text-subtle">confidence {insight.confidence}</span>
      </div>
      <div className="text-[12.5px] font-medium leading-snug">{insight.text}</div>
      <p className="text-[10.5px] leading-relaxed text-secondary text-pretty">{insight.detail}</p>
      {!sidebar && (
        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <Button size="sm" onClick={onAct}>
            {insight.cta}
          </Button>
          <Button size="sm" variant="secondary" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );

  if (!sidebar) return <div className="flex h-full flex-col bg-surface">{body}</div>;

  return (
    <div className="flex flex-col bg-surface sm:flex-row">
      {body}
      <div className="flex flex-none flex-col gap-2 border-t border-border-row bg-surface-subtle p-3 sm:w-[220px] sm:border-l sm:border-t-0">
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">Recommended action</div>
        {sidebar}
      </div>
    </div>
  );
}
