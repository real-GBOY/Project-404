import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api";
import type { EmailStatus } from "@/api/types";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { QueryState } from "@/components/QueryState";
import { errorText } from "@/lib/errors";
import { fmtStamp } from "@/lib/format";
import { EMAIL, EMAIL_TYPE_LABEL } from "@/lib/status";
import { Forbidden } from "./AdminApp";
import { useAuth } from "./auth";
import { Chip, EmptyRow, HeadRow, TableWrap, Td, Th } from "./parts";

const FILTERS: [string, string][] = [["", "All"], ["FAILED", "Failed"], ["RETRYING,QUEUED", "Queued / retrying"], ["ACCEPTED", "Accepted"], ["DELIVERED", "Delivered"]];

export function EmailPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const list = useQuery({ queryKey: ["admin", "emails", filter], queryFn: () => adminApi.emails.list({ status: filter || undefined, limit: 100 }), enabled: can("read:email"), refetchInterval: 10_000 });
  const retry = useMutation({ mutationFn: (id: string) => adminApi.emails.retry(id), onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin"] }) });
  if (!can("read:email")) return <Forbidden needs="read:email" />;
  return (
    <>
      <h1 className="sr-only">Email delivery</h1>
      <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
        {FILTERS.map(([v, label]) => (<Chip key={label} active={filter === v} onClick={() => setFilter(v)}>{label}{v === "FAILED" && list.data ? ` ${list.data.failedCount}` : ""}</Chip>))}
      </div>
      <QueryState query={list}>
        {(d) => (
          <TableWrap min={1040}>
            <HeadRow><Th>Time</Th><Th>Recipient</Th><Th>Type</Th><Th>Booking</Th><Th>Status</Th><Th right>Attempts</Th><Th>Last error</Th><Th /></HeadRow>
            <tbody>
              {d.items.length === 0 ? <EmptyRow cols={8}>No emails here.</EmptyRow> : null}
              {d.items.map((m) => (
                <tr key={m.id} className="border-b border-rule-soft">
                  <Td mono className="text-xs">{fmtStamp(m.at)}</Td>
                  <Td>{m.to}</Td>
                  <Td>{EMAIL_TYPE_LABEL[m.type]}</Td>
                  <Td mono className="text-xs">{m.bookingRef ?? "—"}</Td>
                  <Td><Badge status={EMAIL[m.status as EmailStatus]} /></Td>
                  <Td right mono>{m.attempts}/{m.maxAttempts}</Td>
                  <Td className="max-w-[260px] text-xs text-ink-2">{m.lastError ?? "—"}</Td>
                  <Td right>{m.status === "FAILED" && can("retry:email") ? <Button size="sm" variant="ink" loading={retry.isPending && retry.variables === m.id} onClick={() => retry.mutate(m.id)}>Retry</Button> : null}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </QueryState>
      {retry.isError ? <p role="alert" className="text-sm text-bad-solid">{errorText(retry.error)}</p> : null}
      <p className="text-xs text-muted">Logs hold the message id, type and status only. Ticket tokens, QR images and proof files are never written to the log. “Accepted” means the mail server took the message; with plain SMTP that is the top status.</p>
    </>
  );
}
