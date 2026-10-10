import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { QueryState } from "@/components/QueryState";
import { age, fmtShortDate, money, moneyShort, plural } from "@/lib/format";
import { BOOKING, EMAIL_TYPE_LABEL } from "@/lib/status";
import { useAuth } from "./auth";
import { Card, CardHead, Metric } from "./parts";

export function OverviewPage() {
  const { can, me } = useAuth();
  const nav = useNavigate();
  const report = useQuery({
    queryKey: ["admin", "report", "overview"],
    queryFn: () => adminApi.reports.overview({ days: 30 }),
    enabled: can("read:report"),
  });
  const queue = useQuery({
    queryKey: ["admin", "queue"],
    queryFn: () => adminApi.payments.queue(),
    enabled: can("read:payment"),
    refetchInterval: 20_000,
  });
  const events = useQuery({ queryKey: ["admin", "events"], queryFn: () => adminApi.events.list() });
  const mail = useQuery({
    queryKey: ["admin", "emails", "FAILED"],
    queryFn: () => adminApi.emails.list({ status: "FAILED,RETRYING", limit: 5 }),
    enabled: can("read:email"),
  });
  const recent = useQuery({
    queryKey: ["admin", "bookings", "recent"],
    queryFn: () => adminApi.bookings.list({ limit: 6 }),
    enabled: can("read:booking"),
  });

  const revenue = report.data?.revenueMinor[0];
  const waiting = report.data?.paymentsWaiting;
  const upcoming = (events.data ?? []).filter(
    (e) => e.status === "published" && new Date(e.endsAt) > new Date(),
  );
  const drafts = (events.data ?? []).filter((e) => e.status === "draft").length;

  return (
    <>
      <h1 className="sr-only">Overview</h1>
      {can("read:report") ? (
        <QueryState query={report}>
          {(r) => (
            <>
              <div className="grid border border-ink bg-surface sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label="Verified revenue"
                  value={revenue ? money(revenue.amountMinor, revenue.currency) : "EGP 0.00"}
                  note="Approved payments only"
                  className="border-b border-rule sm:border-r lg:border-b-0"
                />
                <Metric
                  tone="pending"
                  label="◷ Awaiting review"
                  value={plural(waiting?.count ?? 0, "payment")}
                  note={
                    waiting?.oldestMinutes != null
                      ? `oldest ${age(new Date(Date.now() - waiting.oldestMinutes * 60_000))} · not revenue`
                      : "Nothing waiting"
                  }
                  className="border-b border-rule lg:border-b-0 lg:border-r"
                />
                <Metric
                  label="Tickets issued"
                  value={r.tickets.valid + r.tickets.checkedIn}
                  note={`${r.tickets.checkedIn} checked in · ${r.tickets.revoked} revoked`}
                  className="border-b border-rule sm:border-r sm:border-b-0"
                />
                <Metric
                  label="Events"
                  value={
                    <>
                      {upcoming.length} <span className="text-sm text-muted">upcoming</span>
                    </>
                  }
                  note={`${drafts} ${drafts === 1 ? "draft" : "drafts"} · ${events.data?.length ?? 0} total`}
                />
              </div>
              <div className="flex flex-wrap gap-2.5 text-[13px] text-ink-2">
                <Stat
                  label="Bookings"
                  value={Object.values(r.bookingsByStatus).reduce((a, b) => a + (b ?? 0), 0)}
                />
                <Stat
                  label="✓ Verified"
                  value={r.bookingsByStatus.CONFIRMED ?? 0}
                  color="text-ok-fg"
                />
                <Stat
                  label="◷ In review"
                  value={r.bookingsByStatus.IN_REVIEW ?? 0}
                  color="text-pending-fg"
                />
                <Stat label="— Expired" value={r.bookingsByStatus.EXPIRED ?? 0} />
                <Stat
                  label="Emails failed"
                  value={r.emailsFailed}
                  color={r.emailsFailed ? "text-bad-fg" : undefined}
                />
              </div>
            </>
          )}
        </QueryState>
      ) : (
        <p className="text-sm text-ink-2">
          Welcome, {me?.user.name}. Your role shows the events you are assigned to below.
        </p>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {can("read:payment") ? (
          <Card>
            <CardHead
              title="Review queue · oldest first"
              action={
                <Button size="sm" variant="ink" onClick={() => nav("/admin/review")}>
                  Start reviewing
                </Button>
              }
            />
            <QueryState
              query={queue}
              empty={(q) =>
                q.length === 0 ? (
                  <p className="p-5 text-sm text-ink-2">✓ Nothing is waiting for review.</p>
                ) : (
                  false
                )
              }
            >
              {(q) => (
                <ul className="m-0 list-none p-0">
                  {q.slice(0, 5).map((i) => (
                    <li key={i.submissionId}>
                      <Link
                        to={`/admin/review?s=${i.submissionId}`}
                        className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3.5 border-b border-rule-soft px-[18px] py-3 no-underline hover:bg-paper hover:text-ink"
                      >
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm font-semibold">
                            {i.customer}{" "}
                            <span className="font-mono text-xs font-normal text-muted">
                              {i.bookingRef}
                            </span>
                          </span>
                          <span className="truncate text-[13px] text-ink-2">
                            {i.eventTitle}
                            {i.method ? ` · ${i.method}` : ""}
                          </span>
                        </span>
                        <span className="font-mono text-sm font-semibold">
                          {money(i.amountMinor, i.currency)}
                        </span>
                        <span className="min-w-[60px] text-right font-mono text-xs text-ink-2">
                          {age(i.submittedAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
          </Card>
        ) : null}

        <Card>
          <CardHead title="Upcoming events · tickets" action={<Legend />} />
          <QueryState
            query={events}
            empty={() =>
              upcoming.length === 0 ? (
                <p className="p-5 text-sm text-ink-2">No published upcoming events.</p>
              ) : (
                false
              )
            }
          >
            {() => (
              <ul className="m-0 list-none p-0">
                {upcoming.slice(0, 6).map((e) => {
                  const cap = e.ticketTypes.reduce((n, t) => n + t.quantity, 0) || 1;
                  const sold = e.ticketTypes.reduce((n, t) => n + t.held, 0);
                  return (
                    <li
                      key={e.id}
                      className="flex flex-col gap-2 border-b border-rule-soft px-[18px] py-3"
                    >
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate font-semibold">{e.title}</span>
                        <span className="whitespace-nowrap font-mono text-xs text-ink-2">
                          {fmtShortDate(e.startsAt)}
                        </span>
                      </div>
                      <div
                        role="img"
                        aria-label={`${sold} of ${cap} tickets taken or held`}
                        className="flex h-2.5 bg-sunken"
                      >
                        <div className="bg-ink" style={{ width: `${(sold / cap) * 100}%` }} />
                      </div>
                      <span className="font-mono text-xs text-ink-2">
                        {sold} taken or held · {cap} capacity
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </QueryState>
        </Card>

        {can("read:email") ? (
          <Card tone="bad">
            <CardHead
              tone="bad"
              title={`✕ Emails needing attention · ${mail.data?.items.length ?? 0}`}
              action={
                <Link to="/admin/email" className="text-[13px] font-semibold text-bad-ink">
                  Delivery log
                </Link>
              }
            />
            <QueryState
              query={mail}
              empty={(m) =>
                m.items.length === 0 ? (
                  <p className="p-5 text-sm text-ink-2">
                    ✓ Every email was accepted by the provider.
                  </p>
                ) : (
                  false
                )
              }
            >
              {(m) => (
                <ul className="m-0 list-none p-0">
                  {m.items.map((e) => (
                    <li
                      key={e.id}
                      className="flex flex-col gap-0.5 border-b border-rule-soft px-[18px] py-3"
                    >
                      <span className="text-sm font-semibold">{e.to}</span>
                      <span className="text-xs text-ink-2">
                        {EMAIL_TYPE_LABEL[e.type]} ·{" "}
                        <span className="font-mono">{e.bookingRef}</span> ·{" "}
                        {e.lastError ?? e.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
          </Card>
        ) : null}

        {can("read:booking") ? (
          <Card>
            <CardHead
              title="Recent bookings"
              action={
                <Link to="/admin/bookings" className="text-[13px] font-semibold">
                  All bookings
                </Link>
              }
            />
            <QueryState query={recent}>
              {(r) => (
                <ul className="m-0 list-none p-0">
                  {r.items.map((b) => (
                    <li
                      key={b.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-rule-soft px-[18px] py-2.5 text-[13px]"
                    >
                      <span className="truncate">
                        <span className="font-mono text-ink-2">{b.ref}</span> · {b.customerName} ·{" "}
                        {b.eventTitle}
                      </span>
                      <span className="font-mono">{moneyShort(b.totalMinor, b.currency)}</span>
                      <Badge status={BOOKING[b.status]} />
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <span className="rounded-xs border border-rule bg-surface px-2.5 py-1.5">
      {label} <strong className={`font-mono ${color ?? "text-ink"}`}>{value}</strong>
    </span>
  );
}

function Legend() {
  return (
    <span className="flex gap-3 text-xs text-ink-2">
      <span>
        <span className="mr-1 inline-block size-2.5 bg-ink align-[-1px]" />
        Taken or held
      </span>
    </span>
  );
}
