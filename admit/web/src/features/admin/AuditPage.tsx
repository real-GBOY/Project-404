import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api";
import type { AuditRecord } from "@/api/types";
import { Button } from "@/components/Button";
import { QueryState } from "@/components/QueryState";
import { fmtStamp } from "@/lib/format";
import { Forbidden } from "./AdminApp";
import { useAuth } from "./auth";
import { EmptyRow, HeadRow, inputCls, TableWrap, Td, Th } from "./parts";

const PAGE = 50;

/** Plain words for the actions people look for. Anything else is shown as recorded. */
const LABEL: Record<string, string> = {
  "admit.payment.approved": "Payment approved",
  "admit.payment.rejected": "Payment rejected",
  "admit.payment.submitted": "Proof submitted (customer)",
  "admit.booking.created": "Booking made (customer)",
  "admit.booking.expired": "Booking expired (hold ran out)",
  "admit.booking.cancelled": "Booking cancelled",
  "admit.email.retried": "Failed email retried",
  "admit.event_staff.assigned": "Event staff assigned",
  "admit.event_staff.removed": "Event staff removed",
  "admit.payment_method.created": "Payment method added",
  "admit.payment_method.updated": "Payment method edited",
  "admit.payment_method.deleted": "Payment method removed",
  "admit.settings.updated": "Organizer settings changed",
  "admit.ticket_type.created": "Ticket type added",
  "admit.ticket_type.updated": "Ticket type edited",
  "admit.ticket_type.deleted": "Ticket type removed",
  "admit.venue.created": "Venue added",
  "admit.venue.updated": "Venue edited",
  "admit.venue.deleted": "Venue deleted",
  "admit.booking.tickets_resent": "Tickets email sent again",
  "admit.ticket.revoked": "Ticket revoked",
  "admit.event.created": "Event created",
  "admit.event.updated": "Event edited",
  "admit.event.published": "Event published",
  "admit.event.unpublished": "Event unpublished",
  "admit.event.cancelled": "Event cancelled",
  "admit.event.archived": "Event archived",
  "admit.event.deleted": "Draft deleted",
  "admit.team.added": "Person added to the team",
  "admit.team.removed": "Person removed from the team",
  "admit.team.role_removed": "Role removed",
  "admit.team.password_reset": "Password set for a colleague",
  "admit.export.bookings": "Bookings exported",
  "admit.export.tickets": "Attendee list exported",
  "user.logged_in": "Signed in",
  "user.password_changed": "Password changed",
  "user.password_set_by_admin": "Password set by an owner",
};

const ACTIONS = Object.entries(LABEL);

/** Who did what and when, newest first. Read-only: the trail is append-only and enforced by the database. */
export function AuditPage() {
  const { can } = useAuth();
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const team = useQuery({
    queryKey: ["admin", "team"],
    queryFn: () => adminApi.team.get(),
    enabled: can("manage:event_staff"),
  });
  const who = new Map((team.data?.members ?? []).map((m) => [m.userId, m.name]));
  const log = useInfiniteQuery({
    queryKey: ["admin", "audit", action, from],
    queryFn: ({ pageParam }) =>
      adminApi.audit.list({
        action: action || undefined,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        cursor: pageParam,
        limit: PAGE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
    enabled: can("read:audit_log"),
  });
  if (!can("read:audit_log")) return <Forbidden needs="read:audit_log" />;
  const rows: AuditRecord[] = log.data?.pages.flatMap((p) => p.records) ?? [];
  return (
    <>
      <h1 className="sr-only">Audit log</h1>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className={inputCls}
        >
          <option value="">Every action</option>
          {ACTIONS.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          Since
          <input
            type="date"
            aria-label="Since"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>
      <p className="border border-rule bg-surface px-3.5 py-2.5 text-[13px] leading-normal text-ink-2">
        Every approval, refusal, cancellation, revocation, export and change to the team is recorded
        with the person who did it. Records cannot be edited or deleted.
      </p>
      <QueryState query={log}>
        {() => (
          <>
            <TableWrap min={900}>
              <HeadRow>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>What</Th>
                <Th>Record</Th>
              </HeadRow>
              <tbody>
                {rows.length === 0 ? (
                  <EmptyRow cols={4}>Nothing recorded for this filter.</EmptyRow>
                ) : null}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-rule-soft align-top">
                    <Td mono className="whitespace-nowrap text-xs text-ink-2">
                      {fmtStamp(r.createdAt)}
                    </Td>
                    <Td>
                      {r.actorId
                        ? (who.get(r.actorId) ?? (
                            <span className="font-mono text-xs">{r.actorId}</span>
                          ))
                        : r.actorType === "system"
                          ? "System"
                          : "A customer"}
                    </Td>
                    <Td className="font-semibold">
                      {LABEL[r.action] ?? r.action}
                      {LABEL[r.action] ? (
                        <div className="font-mono text-[11px] font-normal text-muted">
                          {r.action}
                        </div>
                      ) : null}
                    </Td>
                    <Td mono className="text-xs text-ink-2">
                      {r.resourceType}
                      {r.resourceId ? ` · ${r.resourceId}` : ""}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {log.hasNextPage ? (
              <div className="pt-3">
                <Button
                  variant="secondary"
                  size="md"
                  loading={log.isFetchingNextPage}
                  onClick={() => void log.fetchNextPage()}
                >
                  Load older records
                </Button>
              </div>
            ) : null}
          </>
        )}
      </QueryState>
    </>
  );
}
