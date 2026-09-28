import { useState } from "react";
import { Link } from "react-router-dom";
import { useActivity, type ActivityItem } from "@/api/workspace";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";

/**
 * The design's Audit Log tab: who did what, to which record, and when — Core's append-only trail
 * for this hotel, made readable by the server. Pages back through history with "Load older".
 */
export function AuditLog() {
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  return (
    <div className="rounded-card border border-border bg-surface px-5">
      {cursors.map((cursor, i) => (
        <Page
          key={cursor ?? "first"}
          cursor={cursor}
          last={i === cursors.length - 1}
          onMore={(next) => setCursors((c) => [...c, next])}
        />
      ))}
    </div>
  );
}

function Page({
  cursor,
  last,
  onMore,
}: {
  cursor: string | undefined;
  last: boolean;
  onMore: (next: string) => void;
}) {
  const page = useActivity(cursor);
  if (page.isLoading) return <LoadingState />;
  if (page.error) return <ErrorState error={page.error} />;
  const { items, nextCursor } = page.data!;
  if (!cursor && items.length === 0)
    return (
      <div className="py-5">
        <EmptyState title="Nothing recorded yet." />
      </div>
    );
  return (
    <>
      <ul className="m-0 list-none p-0">
        {items.map((a) => (
          <Row key={a.id} a={a} />
        ))}
      </ul>
      {last && nextCursor ? (
        <div className="py-4 text-center">
          <Button variant="secondary" size="sm" onClick={() => onMore(nextCursor)}>
            Load older
          </Button>
        </div>
      ) : null}
    </>
  );
}

function Row({ a }: { a: ActivityItem }) {
  return (
    <li className="flex gap-3.5 border-b border-border-subtle py-3.5 last:border-b-0">
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          a.severity === "warning" ? "bg-warning" : "bg-info",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="text-small">
          <span className="font-bold">{a.actorName}</span> {a.verb}{" "}
          {a.subject ? (
            a.href ? (
              <Link to={a.href} className="font-semibold text-primary hover:text-primary-strong">
                {a.subject}
              </Link>
            ) : (
              <span className="font-semibold">{a.subject}</span>
            )
          ) : null}
        </div>
        {a.detail ? <div className="mt-[3px] text-label text-muted">{a.detail}</div> : null}
      </div>
      <time dateTime={a.at} className="shrink-0 text-label whitespace-nowrap text-faint">
        {formatRelative(a.at)}
      </time>
    </li>
  );
}
