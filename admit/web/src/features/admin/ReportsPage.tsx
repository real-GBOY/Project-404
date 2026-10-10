import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api";
import { QueryState } from "@/components/QueryState";
import { money, moneyShort } from "@/lib/format";
import { Forbidden } from "./AdminApp";
import { useAuth } from "./auth";
import { Card, CardHead, inputCls } from "./parts";

export function ReportsPage() {
  const { can } = useAuth();
  const [eventId, setEventId] = useState("");
  const [days, setDays] = useState(30);
  const events = useQuery({ queryKey: ["admin", "events"], queryFn: () => adminApi.events.list() });
  const r = useQuery({
    queryKey: ["admin", "report", eventId, days],
    queryFn: () => adminApi.reports.overview({ eventId: eventId || undefined, days }),
    enabled: can("read:report"),
    placeholderData: (p) => p,
  });
  if (!can("read:report")) return <Forbidden needs="read:report" />;
  return (
    <>
      <h1 className="sr-only">Reports</h1>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Period"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className={`${inputCls} border-ink font-semibold`}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
        </select>
        <select
          aria-label="Event"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className={inputCls}
        >
          <option value="">All events</option>
          {events.data?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
      </div>
      <QueryState query={r}>
        {(d) => {
          const total = Object.values(d.bookingsByStatus).reduce((a, b) => a + (b ?? 0), 0);
          const rev = d.revenueMinor[0];
          const peak = Math.max(...d.salesByDay.map((s) => s.bookings), 1);
          const metrics: [string, string, string, string?][] = [
            [
              "Verified payments",
              rev ? money(rev.amountMinor, rev.currency) : "EGP 0.00",
              "Sum of approved bookings. The only figure that counts as revenue.",
            ],
            [
              "In review",
              String(d.bookingsByStatus.IN_REVIEW ?? 0),
              "Proof submitted, not yet decided. Not revenue.",
              "text-pending-fg",
            ],
            [
              "Rejected",
              String(d.bookingsByStatus.REJECTED ?? 0),
              "Bookings whose resubmission window ended after a rejection.",
              "text-bad-fg",
            ],
            [
              "Bookings",
              String(total),
              "Created in this period, any status. Not the same as tickets.",
            ],
            [
              "Tickets issued",
              String(d.tickets.valid + d.tickets.checkedIn),
              `Valid or used; ${d.tickets.revoked} revoked are counted separately.`,
            ],
            [
              "Check-in rate",
              d.tickets.valid + d.tickets.checkedIn
                ? `${Math.round((d.tickets.checkedIn / (d.tickets.valid + d.tickets.checkedIn)) * 100)}%`
                : "—",
              `${d.tickets.checkedIn} checked in of ${d.tickets.valid + d.tickets.checkedIn} valid.`,
            ],
          ];
          return (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {metrics.map(([label, value, def, color]) => (
                  <div
                    key={label}
                    className="flex flex-col gap-1.5 border border-rule bg-surface p-4"
                  >
                    <span className="label text-ink-2">{label}</span>
                    <span className={`font-mono text-2xl font-semibold ${color ?? ""}`}>
                      {value}
                    </span>
                    <span className="text-xs leading-snug text-muted">{def}</span>
                  </div>
                ))}
              </div>
              <div className="grid items-start gap-6 xl:grid-cols-2">
                <Card>
                  <CardHead title="Tickets by type" />
                  <div className="flex flex-col gap-2.5 p-[18px]">
                    {d.byTicketType.length === 0 ? (
                      <p className="text-sm text-ink-2">No ticket types yet.</p>
                    ) : null}
                    {d.byTicketType.map((t) => (
                      <div
                        key={t.ticketTypeId}
                        className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_110px] items-center gap-2.5 text-[13px]"
                      >
                        <span className="truncate">{t.name}</span>
                        <div
                          className="flex h-3.5 bg-sunken"
                          role="img"
                          aria-label={`${t.sold} sold, ${t.held} held, of ${t.capacity}`}
                        >
                          <div
                            className="bg-ink"
                            style={{ width: `${(t.sold / Math.max(t.capacity, 1)) * 100}%` }}
                          />
                          <div
                            className="bg-[#b9a8ec]"
                            style={{ width: `${(t.held / Math.max(t.capacity, 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-right font-mono text-xs">
                          {t.sold}
                          {t.held ? ` + ${t.held}` : ""} / {t.capacity}
                        </span>
                      </div>
                    ))}
                    <span className="text-xs text-muted">
                      Dark = sold (verified). Lilac = held or in review.
                    </span>
                  </div>
                </Card>
                <Card>
                  <CardHead title="Bookings per day" />
                  <div className="flex flex-col gap-2 p-[18px]">
                    {d.salesByDay.length === 0 ? (
                      <p className="text-sm text-ink-2">No bookings in this period.</p>
                    ) : (
                      <>
                        <div
                          role="img"
                          aria-label={`Up to ${peak} bookings a day`}
                          className="flex h-28 items-end gap-1"
                        >
                          {d.salesByDay.map((s) => (
                            <div
                              key={s.day}
                              title={`${s.day} · ${s.bookings} bookings · ${moneyShort(s.revenueMinor)}`}
                              className="flex-1 bg-ink"
                              style={{ height: `${(s.bookings / peak) * 100}%`, minHeight: 2 }}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between font-mono text-[11px] text-muted">
                          <span>{d.salesByDay[0]!.day}</span>
                          <span>Peak {peak}</span>
                          <span>{d.salesByDay[d.salesByDay.length - 1]!.day}</span>
                        </div>
                      </>
                    )}
                    <span className="text-xs text-muted">
                      Days are Cairo days.{" "}
                      {d.emailsFailed
                        ? `${d.emailsFailed} emails failed to send.`
                        : "No failed emails."}
                    </span>
                  </div>
                </Card>
              </div>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
