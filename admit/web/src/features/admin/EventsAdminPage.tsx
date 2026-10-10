import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api";
import type { AdminEvent, EventStatus } from "@/api/types";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { QueryState } from "@/components/QueryState";
import { fmtShortDate, moneyShort } from "@/lib/format";
import { EVENT } from "@/lib/status";
import { useAuth } from "./auth";
import { Chip, EmptyRow, HeadRow, inputCls, TableWrap, Td, Th } from "./parts";

export function EventsAdminPage() {
  const { can } = useAuth();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["admin", "events"], queryFn: () => adminApi.events.list() });
  const [tab, setTab] = useState<"all" | EventStatus>("all");
  const [search, setSearch] = useState("");
  return (
    <>
      <h1 className="sr-only">Events</h1>
      <QueryState query={q}>
        {(events) => {
          const n = (s: EventStatus) => events.filter((e) => e.status === s).length;
          const shown = events.filter((e) => (tab === "all" || e.status === tab) && e.title.toLowerCase().includes(search.trim().toLowerCase()));
          return (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div role="group" aria-label="Status" className="flex flex-1 flex-wrap gap-2">
                  <Chip active={tab === "all"} onClick={() => setTab("all")}>All {events.length}</Chip>
                  <Chip active={tab === "published"} onClick={() => setTab("published")}>Published {n("published")}</Chip>
                  <Chip active={tab === "draft"} onClick={() => setTab("draft")}>Drafts {n("draft")}</Chip>
                  <Chip active={tab === "cancelled"} onClick={() => setTab("cancelled")}>Cancelled {n("cancelled")}</Chip>
                  <Chip active={tab === "archived"} onClick={() => setTab("archived")}>Archived {n("archived")}</Chip>
                </div>
                <input aria-label="Search events" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events" className={inputCls} />
                {can("create:event") ? <Button size="md" onClick={() => nav("/admin/events/new")}>New event</Button> : null}
              </div>
              <TableWrap min={980}>
                <HeadRow><Th>Event</Th><Th>Date</Th><Th>Status</Th><Th className="w-[200px]">Taken / capacity</Th><Th right>Price from</Th><Th /></HeadRow>
                <tbody>
                  {shown.length === 0 ? <EmptyRow cols={6}>No events here yet.</EmptyRow> : null}
                  {shown.map((e) => <Row key={e.id} e={e} canEdit={can("update:event")} canCheckin={can("read:checkin")} />)}
                </tbody>
              </TableWrap>
            </>
          );
        }}
      </QueryState>
    </>
  );
}

function Row({ e, canEdit, canCheckin }: { e: AdminEvent; canEdit: boolean; canCheckin: boolean }) {
  const cap = e.ticketTypes.reduce((n, t) => n + t.quantity, 0);
  const taken = e.ticketTypes.reduce((n, t) => n + t.held, 0);
  const min = e.ticketTypes.length ? Math.min(...e.ticketTypes.map((t) => t.priceMinor)) : null;
  return (
    <tr className="border-b border-rule-soft">
      <Td>
        <div className="flex items-center gap-3">
          <div className="stripes h-10 w-14 flex-none" aria-hidden="true" />
          <span className="flex flex-col gap-0.5"><span className="font-semibold">{e.title}</span><span className="text-xs text-muted">{e.venue.name}</span></span>
        </div>
      </Td>
      <Td mono className="text-xs">{fmtShortDate(e.startsAt)}</Td>
      <Td><Badge status={EVENT[e.status]} /></Td>
      <Td>
        <div className="flex flex-col gap-1">
          <div className="h-1.5 bg-sunken" role="img" aria-label={`${taken} of ${cap} taken`}><div className="h-1.5 bg-ink" style={{ width: `${cap ? (taken / cap) * 100 : 0}%` }} /></div>
          <span className="font-mono text-[11px] text-ink-2">{taken} / {cap}</span>
        </div>
      </Td>
      <Td right mono>{min != null ? moneyShort(min, e.currency) : "—"}</Td>
      <Td right className="whitespace-nowrap">
        {canEdit ? <Link to={`/admin/events/${e.id}`} className="mr-1 inline-flex h-8 items-center rounded-sm border border-rule-strong bg-surface px-3 text-xs font-semibold no-underline">Edit</Link> : null}
        {canCheckin && e.status === "published" ? <Link to={`/admin/checkin?e=${e.id}`} className="inline-flex h-8 items-center rounded-sm border border-rule-strong bg-surface px-3 text-xs font-semibold no-underline">Check-in</Link> : null}
      </Td>
    </tr>
  );
}
