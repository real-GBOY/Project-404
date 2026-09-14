import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  traceId?: string;
  onRetry?: () => void;
}

/** The design's one explicit error example (Revenue Analytics forecast timeout):
 *  red-bordered banner, retry action, monospace trace id footer — the pattern for
 *  any async widget that can fail while the rest of the page keeps rendering. */
export function ErrorState({
  title = "This widget couldn't load",
  message = "The request didn't return in time. The rest of the page is unaffected.",
  traceId,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-card border border-danger-border bg-danger-surface px-3.5 py-3">
      <span className="mt-0.5 flex size-7 flex-none items-center justify-center rounded-card bg-white text-danger">
        <Icon name="alert" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-danger">{title}</div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-secondary text-pretty">{message}</p>
        <div className="mt-2 flex items-center gap-2">
          {onRetry && (
            <Button size="sm" variant="secondary" icon="history" onClick={onRetry}>
              Retry
            </Button>
          )}
          <button type="button" className="text-[11px] text-primary hover:underline">
            View status page
          </button>
        </div>
        {traceId && (
          <div className="mt-2 font-mono text-[9.5px] text-subtle">trace: {traceId}</div>
        )}
      </div>
    </div>
  );
}
