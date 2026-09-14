import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/avatar";

export interface KanbanCardData {
  id: string;
  name: string;
  interest: string;
  value: string;
  score: number;
  agent: string;
  when: string;
}

const SCORE_COLOR = (score: number) =>
  score >= 85 ? "text-success" : score >= 65 ? "text-primary" : "text-danger-solid";
const SCORE_BAR = (score: number) =>
  score >= 85 ? "bg-success" : score >= 65 ? "bg-primary" : "bg-danger-solid";

export function KanbanCard({
  card,
  onDragStart,
  onClick,
}: {
  card: KanbanCardData;
  onDragStart?: (e: React.DragEvent) => void;
  onClick?: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className="cursor-grab rounded-card border border-border bg-surface p-2.5 transition-colors hover:border-primary"
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <Avatar name={card.name} size={20} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11.5px] font-semibold">{card.name}</div>
          <div className="font-mono text-[9.5px] text-subtle">{card.id}</div>
        </div>
      </div>
      <div className="truncate text-[10.5px] text-body">{card.interest}</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="font-mono text-[11px] font-semibold">{card.value}</span>
        <div className="flex-1" />
        <div className="h-1 w-8 bg-surface-track">
          <div className={cn("h-full", SCORE_BAR(card.score))} style={{ width: `${card.score}%` }} />
        </div>
        <span className={cn("font-mono text-[9.5px]", SCORE_COLOR(card.score))}>{card.score}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-1 border-t border-border-row pt-1.5">
        <span className="flex-1 truncate text-[9.5px] text-subtle">{card.agent}</span>
        <span className="text-[9.5px] text-subtle">{card.when}</span>
      </div>
    </div>
  );
}

export function KanbanColumn({
  label,
  color,
  count,
  value,
  onDragOver,
  onDrop,
  children,
}: {
  label: string;
  color: string;
  count: number;
  value: string;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  children: ReactNode;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="flex w-[232px] flex-none flex-col rounded-card border border-border bg-surface-subtle-2"
    >
      <div className="rounded-t-card border-b border-border bg-surface px-2.5 py-2">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 flex-none rounded-full" style={{ background: color }} />
          <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-body">{label}</span>
          <div className="flex-1" />
          <span className="rounded-badge bg-surface-track px-1 font-mono text-[10px] text-body">{count}</span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-subtle">{value}</div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">{children}</div>
    </div>
  );
}
