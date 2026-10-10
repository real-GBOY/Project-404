import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api";
import { Badge } from "@/components/Badge";
import { QueryState } from "@/components/QueryState";
import { fmtStamp, moneyShort } from "@/lib/format";
import { BOOKING } from "@/lib/status";
import { Forbidden } from "./AdminApp";
import { useAuth } from "./auth";
import { useDebounced } from "./use-debounced";
import { EmptyRow, HeadRow, inputCls, Pager, TableWrap, Td, Th } from "./parts";

const LIMIT = 25;

export function CustomersPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const q = useDebounced(search);
  const list = useQuery({ queryKey: ["admin", "customers", q, offset], queryFn: () => adminApi.bookings.customers({ search: q || undefined, limit: LIMIT, offset }), enabled: can("read:booking"), placeholderData: (p) => p });
  if (!can("read:booking")) return <Forbidden needs="read:booking" />;
  return (
    <>
      <h1 className="sr-only">Customers</h1>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search customers" value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} placeholder="Name, email or phone" className={`${inputCls} min-w-[240px] flex-1 border-ink`} />
        <span className="text-xs text-ink-2">Customers are guests: grouped by the email they booked with.</span>
      </div>
      <QueryState query={list}>
        {(d) => (
          <div>
            <TableWrap min={880}>
              <HeadRow><Th>Customer</Th><Th>Phone</Th><Th right>Bookings</Th><Th right>Events attended</Th><Th right>Verified spend</Th><Th>Latest</Th><Th>Last booking</Th></HeadRow>
              <tbody>
                {d.items.length === 0 ? <EmptyRow cols={7}>No customers yet.</EmptyRow> : null}
                {d.items.map((c) => (
                  <tr key={c.email} className="border-b border-rule-soft">
                    <Td><span className="font-semibold">{c.name}</span><br /><span className="text-xs text-muted">{c.email}</span></Td>
                    <Td mono className="text-xs">{c.phone}</Td>
                    <Td right mono>{c.bookings}</Td>
                    <Td right mono>{c.attended}</Td>
                    <Td right mono>{moneyShort(c.spendMinor)}</Td>
                    <Td><Badge status={BOOKING[c.latestStatus]} /></Td>
                    <Td mono className="text-xs text-ink-2">{fmtStamp(c.lastBookingAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pager total={d.total} limit={LIMIT} offset={offset} onOffset={setOffset} />
          </div>
        )}
      </QueryState>
    </>
  );
}
