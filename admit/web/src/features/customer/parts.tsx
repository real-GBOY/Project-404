import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { EventCard as EventCardData } from "@/api/types";
import { dateBlock, fmtTime, moneyShort } from "@/lib/format";
import { availabilityText } from "./availability";

export function Page({ children, narrow, className = "" }: { children: ReactNode; narrow?: boolean | "xs"; className?: string }) {
  const w = narrow === "xs" ? "max-w-[720px]" : narrow ? "max-w-[1120px]" : "max-w-[1280px]";
  return <div className={`mx-auto w-full ${w} px-4 pt-7 md:px-6 ${className}`}>{children}</div>;
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2.5">
      <h2 className="display-l text-3xl md:text-4xl">{title}</h2>
      {action}
    </div>
  );
}

/** The calendar block used in lists: FRI / 14 / NOV. */
export function DateBlock({ iso, size = 36 }: { iso: string; size?: number }) {
  const b = dateBlock(iso);
  return (
    <span className="flex w-[72px] flex-none flex-col items-center leading-none" aria-hidden="true">
      <span className="font-mono text-[11px] text-muted">{b.dow}</span>
      <span className="font-display font-black" style={{ fontSize: size, fontStretch: "70%" }}>
        {b.day}
      </span>
      <span className="font-mono text-[11px] text-brand-deep">{b.mon}</span>
    </span>
  );
}

/** Event photo, or the striped placeholder until the organizer uploads one. */
export function Cover({ url, ratio = "4/3", label, night, className = "" }: { url: string | null; ratio?: string; label?: string; night?: boolean; className?: string }) {
  if (url) return <img src={url} alt="" className={`w-full object-cover ${className}`} style={{ aspectRatio: ratio }} />;
  return (
    <div className={`${night ? "stripes-night text-faint" : "stripes text-muted"} flex w-full items-end p-2.5 font-mono text-[11px] ${className}`} style={{ aspectRatio: ratio }} aria-hidden="true">
      {label}
    </div>
  );
}

export function EventCard({ org, e }: { org: string; e: EventCardData }) {
  const b = dateBlock(e.startsAt);
  const a = availabilityText(e.availability);
  return (
    <Link to={`/e/${org}/events/${e.slug}`} className="group flex flex-col border border-rule bg-surface no-underline hover:border-ink hover:text-ink">
      <div className="relative">
        <Cover url={e.coverUrl} />
        {e.category ? <span className="absolute bottom-2.5 right-2.5 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold">{e.category}</span> : null}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <span className="font-mono text-xs text-brand-deep">
          {b.dow} {b.day} {b.mon} · {fmtTime(e.startsAt)}
        </span>
        <span className="display-l text-[22px]">{e.title}</span>
        <span className="text-sm text-ink-2">
          {e.venue.name}
          {e.venue.area ? `, ${e.venue.area}` : ""}
        </span>
        <span className="mt-1 flex items-center justify-between border-t border-dashed border-rule-strong pt-2.5 text-sm">
          <span>
            {e.minPriceMinor != null ? (
              <>
                From <strong className="font-mono">{moneyShort(e.minPriceMinor, e.currency)}</strong>
              </>
            ) : (
              "—"
            )}
          </span>
          <span className={`text-xs ${a.cls}`}>{a.text}</span>
        </span>
      </div>
    </Link>
  );
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="grid border-y border-ink sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
      {rows.map(([k, v], i) => (
        <div key={k} className={`flex flex-col gap-1 px-4 py-3.5 ${i ? "sm:border-l sm:border-rule" : "sm:pl-0"}`}>
          <span className="label text-muted">{k}</span>
          <span className="font-semibold">{v}</span>
        </div>
      ))}
    </div>
  );
}
