import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api";
import { Badge } from "@/components/Badge";
import { QueryState } from "@/components/QueryState";
import { fmtTime, fmtTimeSec } from "@/lib/format";
import { SCAN } from "@/lib/status";
import { Forbidden } from "./AdminApp";
import { useAuth } from "./auth";
import { Card, CardHead, inputCls } from "./parts";

const REASON: Record<string, string> = {
  unknown: "Unknown code",
  revoked: "Revoked",
  other_event: "Other event",
  event_closed: "Event closed",
  not_paid: "Not paid yet",
};

export function CheckinPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const events = useQuery({ queryKey: ["admin", "events"], queryFn: () => adminApi.events.list() });
  const published = (events.data ?? []).filter((e) => e.status === "published");
  const eventId = params.get("e") ?? published[0]?.id ?? "";
  const overview = useQuery({
    queryKey: ["admin", "checkin", eventId],
    queryFn: () => adminApi.checkin.overview(eventId),
    enabled: !!eventId && can("read:checkin"),
    refetchInterval: 5000,
  });
  if (!can("read:checkin")) return <Forbidden needs="read:checkin" />;

  return (
    <>
      <h1 className="sr-only">Check-in</h1>
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          aria-label="Event"
          value={eventId}
          onChange={(e) => setParams({ e: e.target.value })}
          className={`${inputCls} h-11 border-ink font-semibold`}
        >
          {published.length === 0 ? <option value="">No published events</option> : null}
          {published.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <span
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok-fg"
          role="status"
        >
          <span className="size-2 rounded-full bg-ok-solid" />
          Live · refreshes every 5 s
        </span>
        <span className="flex-1" />
        {can("scan:checkin") ? (
          <Link
            to="/scan"
            className="inline-flex h-11 items-center rounded-sm bg-ink px-4 text-sm font-semibold text-paper no-underline hover:text-paper"
          >
            Open scanner ↗
          </Link>
        ) : null}
      </div>
      {!eventId ? (
        <p className="text-sm text-ink-2">Publish an event to see its door activity here.</p>
      ) : (
        <QueryState query={overview}>
          {(o) => {
            const pct = o.totals.validTickets
              ? Math.round((o.totals.checkedIn / o.totals.validTickets) * 100)
              : 0;
            const peak = Math.max(...o.arrivals.map((a) => a.count), 1);
            return (
              <>
                <div className="grid border border-ink bg-surface sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Checked in", o.totals.checkedIn, ""],
                    ["Not yet arrived", o.totals.remaining, ""],
                    ["Valid tickets", o.totals.validTickets, `${o.totals.revoked} revoked`],
                  ].map(([label, n, note]) => (
                    <div
                      key={String(label)}
                      className="flex flex-col gap-1 border-b border-rule p-5 sm:border-r lg:border-b-0"
                    >
                      <span className="label text-ink-2">{label}</span>
                      <span
                        className="font-display text-[64px] font-black leading-[0.9]"
                        style={{ fontStretch: "70%" }}
                      >
                        {n}
                      </span>
                      {note ? <span className="text-xs text-muted">{note}</span> : null}
                    </div>
                  ))}
                  <div className="flex flex-col justify-between gap-2 p-5">
                    <span className="label text-ink-2">Attendance</span>
                    <span className="font-mono text-[32px] font-semibold">{pct}%</span>
                    <div
                      className="h-2 bg-sunken"
                      role="img"
                      aria-label={`${pct}% of valid tickets checked in`}
                    >
                      <div className="h-2 bg-ok-solid" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="grid items-start gap-6 xl:grid-cols-2">
                  <Card>
                    <CardHead
                      title="Scan log"
                      action={
                        <span className="text-xs text-ink-2">
                          Latest 50 · every verdict the server recorded
                        </span>
                      }
                    />
                    {o.scans.length === 0 ? (
                      <p className="p-5 text-sm text-ink-2">No scans yet.</p>
                    ) : null}
                    {o.scans.map((s) => (
                      <div
                        key={s.id}
                        className="grid grid-cols-[64px_130px_minmax(0,1fr)_auto] items-center gap-3 border-b border-rule-soft px-[18px] py-2.5 text-[13px]"
                      >
                        <span className="font-mono text-xs text-ink-2">{fmtTimeSec(s.at)}</span>
                        <span className="justify-self-start">
                          <Badge
                            status={
                              s.result === "INVALID" && s.reason
                                ? { ...SCAN.INVALID, label: REASON[s.reason] ?? "Invalid" }
                                : SCAN[s.result]
                            }
                          />
                        </span>
                        <span className="min-w-0 truncate">
                          {s.holder ?? "—"}{" "}
                          <span className="font-mono text-[11px] text-muted">
                            {s.ticketId ?? ""}
                          </span>
                          {s.method === "MANUAL" ? (
                            <span className="ml-1 text-[11px] text-muted">typed</span>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted">
                          {[s.gate, s.staff].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                    ))}
                  </Card>
                  <Card>
                    <CardHead title="By ticket type" />
                    {o.byType.map((b) => (
                      <div
                        key={b.ticketTypeId}
                        className="flex flex-col gap-1.5 border-b border-rule-soft px-[18px] py-3"
                      >
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold">{b.name}</span>
                          <span className="font-mono">
                            {b.checkedIn} / {b.total}
                          </span>
                        </div>
                        <div className="h-1.5 bg-sunken">
                          <div
                            className="h-1.5 bg-ok-solid"
                            style={{ width: `${b.total ? (b.checkedIn / b.total) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-col gap-1.5 px-[18px] py-3.5">
                      <span className="text-sm font-semibold">Arrivals per 15 min</span>
                      {o.arrivals.length === 0 ? (
                        <span className="text-xs text-muted">No arrivals yet.</span>
                      ) : (
                        <>
                          <div
                            role="img"
                            aria-label={`Peak ${peak} check-ins in a 15 minute window`}
                            className="flex h-20 items-end gap-1"
                          >
                            {o.arrivals.map((a) => (
                              <div
                                key={a.at}
                                title={`${fmtTime(a.at)} · ${a.count}`}
                                className="flex-1 bg-ink"
                                style={{ height: `${(a.count / peak) * 100}%` }}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between font-mono text-[11px] text-muted">
                            <span>{fmtTime(o.arrivals[0]!.at)}</span>
                            <span>Peak {peak}</span>
                            <span>{fmtTime(o.arrivals[o.arrivals.length - 1]!.at)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                </div>
              </>
            );
          }}
        </QueryState>
      )}
    </>
  );
}
