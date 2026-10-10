import type { ReactNode } from "react";

export function Card({ children, className = "", tone }: { children: ReactNode; className?: string; tone?: "bad" | "ink" }) {
  const border = tone === "bad" ? "border-bad-line" : tone === "ink" ? "border-ink" : "border-rule";
  return <section className={`flex flex-col border bg-surface ${border} ${className}`}>{children}</section>;
}

export function CardHead({ title, action, tone }: { title: ReactNode; action?: ReactNode; tone?: "bad" }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 border-b px-[18px] py-3.5 ${tone === "bad" ? "border-bad-line bg-[#fdf3f1]" : "border-rule"}`}>
      <h2 className={`m-0 text-base font-semibold ${tone === "bad" ? "text-bad-ink" : ""}`}>{title}</h2>
      {action}
    </div>
  );
}

/** A responsive table wrapper: horizontal scroll under its min width, with a hairline frame. */
export function TableWrap({ children, min = 900 }: { children: ReactNode; min?: number }) {
  return (
    <div className="overflow-x-auto border border-rule bg-surface">
      <table className="w-full border-collapse text-[13px]" style={{ minWidth: min }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, right, className = "" }: { children?: ReactNode; right?: boolean; className?: string }) {
  return (
    <th scope="col" className={`px-2 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2 first:pl-3.5 last:pr-3.5 ${right ? "text-right" : "text-left"} ${className}`}>
      {children}
    </th>
  );
}
export const HeadRow = ({ children }: { children: ReactNode }) => (
  <thead>
    <tr className="border-b border-ink">{children}</tr>
  </thead>
);

export function Td({ children, right, mono, className = "" }: { children?: ReactNode; right?: boolean; mono?: boolean; className?: string }) {
  return <td className={`px-2 py-2.5 align-middle first:pl-3.5 last:pr-3.5 ${right ? "text-right" : ""} ${mono ? "font-mono" : ""} ${className}`}>{children}</td>;
}

export function Metric({ label, value, note, tone, className = "" }: { label: ReactNode; value: ReactNode; note?: ReactNode; tone?: "pending"; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 px-5 py-[18px] ${tone === "pending" ? "bg-[#f7f4fd]" : ""} ${className}`}>
      <span className={`label ${tone === "pending" ? "text-pending-fg" : "text-ink-2"}`}>{label}</span>
      <span className={`font-mono text-[28px] font-semibold ${tone === "pending" ? "text-[#3e2a85]" : ""}`}>{value}</span>
      {note ? <span className="text-xs text-muted">{note}</span> : null}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-pressed={active} onClick={onClick} className={`h-9 rounded-full px-3.5 text-sm font-medium ${active ? "bg-ink text-paper" : "border border-rule-strong bg-surface text-ink-2"}`}>
      {children}
    </button>
  );
}

export function Pager({ total, limit, offset, onOffset }: { total: number; limit: number; offset: number; onOffset: (n: number) => void }) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="flex items-center justify-between border-t border-rule px-3.5 py-2.5 text-[13px] text-ink-2">
      <span role="status">{from}–{to} of {total}</span>
      <div className="flex gap-1">
        <button disabled={offset === 0} onClick={() => onOffset(Math.max(offset - limit, 0))} className="h-8 rounded-xs border border-rule-strong bg-surface px-2.5 disabled:text-faint">Prev</button>
        <button disabled={offset + limit >= total} onClick={() => onOffset(offset + limit)} className="h-8 rounded-xs border border-rule-strong bg-surface px-2.5 disabled:text-faint">Next</button>
      </div>
    </div>
  );
}

export const inputCls = "h-10 rounded-sm border border-rule-strong bg-surface px-3 text-sm";

export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-sm text-ink-2">
        {children}
      </td>
    </tr>
  );
}
