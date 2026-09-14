import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export interface WorkflowStep {
  label: string;
  state: "done" | "current" | "pending";
  who: string;
  when: string;
  note?: string;
}

const STEP_ICON: Record<WorkflowStep["state"], string> = {
  done: "step-done",
  current: "step-current",
  pending: "step-pending",
};

const STEP_CLASS: Record<WorkflowStep["state"], string> = {
  done: "bg-success text-white",
  current: "bg-primary text-white",
  pending: "bg-surface-track text-muted",
};

export function WorkflowStepper({ title, steps }: { title: string; steps: WorkflowStep[] }) {
  return (
    <div className="rounded-card border border-border bg-surface p-3.5">
      <div className="mb-3 text-[12px] font-semibold">{title}</div>
      <div className="flex items-start gap-0">
        {steps.map((s, i) => (
          <div key={s.label} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <div className="flex w-full items-center">
              <div className={cn("h-px flex-1", i === 0 ? "bg-transparent" : "bg-border")} />
              <span className={cn("flex size-6 flex-none items-center justify-center rounded-full", STEP_CLASS[s.state])}>
                <Icon name={STEP_ICON[s.state]} size={12} />
              </span>
              <div className={cn("h-px flex-1", i === steps.length - 1 ? "bg-transparent" : "bg-border")} />
            </div>
            <div className="text-[10.5px] font-semibold">{s.label}</div>
            <div className="text-[9.5px] text-subtle">{s.who}</div>
            <div className="text-[9px] text-faint">{s.when}</div>
            {s.state === "current" && s.note && (
              <div className="mt-0.5 max-w-[120px] text-[9.5px] text-warning">{s.note}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
