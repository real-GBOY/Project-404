import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ReasonDialog } from "@/components/ReasonDialog";
import { QueryState } from "@/components/QueryState";
import { errorText } from "@/lib/errors";
import { fmtStamp } from "@/lib/format";
import { TICKET } from "@/lib/status";
import { Forbidden } from "./AdminApp";
import { useAuth } from "./auth";
import { useDebounced } from "./use-debounced";
import { EmptyRow, HeadRow, inputCls, TableWrap, Td, Th } from "./parts";

export function TicketsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const q = useDebounced(search);
  const events = useQuery({ queryKey: ["admin", "events"], queryFn: () => adminApi.events.list() });
  const list = useQuery({ queryKey: ["admin", "tickets", q, eventId], queryFn: () => adminApi.tickets.list({ q: q || undefined, eventId: eventId || undefined, limit: 100 }), enabled: can("read:ticket"), placeholderData: (p) => p });
  const revoke = useMutation({ mutationFn: (v: { id: string; reason: string }) => adminApi.tickets.revoke(v.id, v.reason), onSuccess: () => { setRevoking(null); void qc.invalidateQueries({ queryKey: ["admin"] }); } });
  if (!can("read:ticket")) return <Forbidden needs="read:ticket" />;
  return (
    <>
      <h1 className="sr-only">Tickets</h1>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search tickets" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ticket ID or holder" className={`${inputCls} min-w-[240px] flex-1 border-ink`} />
        <select aria-label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)} className={inputCls}>
          <option value="">All events</option>
          {events.data?.map((e) => (<option key={e.id} value={e.id}>{e.title}</option>))}
        </select>
      </div>
      <p className="border border-rule bg-surface px-3.5 py-2.5 text-[13px] leading-normal text-ink-2"><strong className="text-ink">Checked in</strong> means the ticket was scanned and admitted. <strong className="text-ink">Revoked</strong> means an organizer invalidated it (refund, holder change, fraud) - its QR is rejected at the door. Tickets are never deleted; revocation is recorded in the audit log. QR tokens are never shown here.</p>
      <QueryState query={list}>
        {(d) => (
          <TableWrap min={960}>
            <HeadRow><Th>Ticket ID</Th><Th>Holder</Th><Th>Type</Th><Th>Booking</Th><Th>Status</Th><Th>Check-in</Th><Th /></HeadRow>
            <tbody>
              {d.length === 0 ? <EmptyRow cols={7}>No tickets match.</EmptyRow> : null}
              {d.map((t) => (
                <tr key={t.id} className="border-b border-rule-soft">
                  <Td mono>{t.id}</Td>
                  <Td className="font-semibold">{t.holderName}</Td>
                  <Td>{t.ticketType}<br /><span className="text-xs text-muted">{t.eventTitle}</span></Td>
                  <Td mono className="text-xs text-ink-2">{t.bookingRef}</Td>
                  <Td><Badge status={TICKET[t.status]} /></Td>
                  <Td className="text-xs text-ink-2">{t.status === "USED" && t.checkedInAt ? `${fmtStamp(t.checkedInAt)}${t.checkedInGate ? ` · ${t.checkedInGate}` : ""}` : t.status === "REVOKED" ? `Revoked${t.revokedReason ? `: ${t.revokedReason}` : ""}` : "Not checked in"}</Td>
                  <Td right>{t.status === "VALID" && can("revoke:ticket") ? <Button size="sm" variant="danger" onClick={() => setRevoking(t.id)}>Revoke…</Button> : null}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </QueryState>
      <ReasonDialog open={!!revoking} onClose={() => setRevoking(null)} title="Revoke this ticket?" body="Its QR stops working at the door from the next scan. Use this for a refund, a holder change or fraud." confirmLabel="Revoke ticket" busy={revoke.isPending} error={revoke.isError ? errorText(revoke.error) : null} onConfirm={(reason) => revoke.mutate({ id: revoking!, reason })} />
    </>
  );
}
