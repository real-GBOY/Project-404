import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api";
import type { BookingStatus, BookingSummary } from "@/api/types";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { ReasonDialog } from "@/components/ReasonDialog";
import { TextArea } from "@/components/Field";
import { QueryState } from "@/components/QueryState";
import { errorText } from "@/lib/errors";
import { fmtStamp, money, moneyShort } from "@/lib/format";
import { BOOKING, EMAIL, EMAIL_TYPE_LABEL, SUBMISSION, TICKET } from "@/lib/status";
import { Forbidden } from "./AdminApp";
import { useAuth } from "./auth";
import { useDebounced } from "./use-debounced";
import { EmptyRow, HeadRow, inputCls, Pager, TableWrap, Td, Th } from "./parts";

const LIMIT = 25;

export function BookingsPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [eventId, setEventId] = useState("");
  const [offset, setOffset] = useState(0);
  const q = useDebounced(search);
  const open = params.get("b");
  const events = useQuery({ queryKey: ["admin", "events"], queryFn: () => adminApi.events.list() });
  const list = useQuery({
    queryKey: ["admin", "bookings", { q, status, eventId, offset }],
    queryFn: () =>
      adminApi.bookings.list({
        search: q || undefined,
        status: status || undefined,
        eventId: eventId || undefined,
        limit: LIMIT,
        offset,
      }),
    enabled: can("read:booking"),
    placeholderData: (p) => p,
  });
  if (!can("read:booking")) return <Forbidden needs="read:booking" />;
  const reset = () => setOffset(0);

  return (
    <>
      <h1 className="sr-only">Bookings</h1>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Search bookings"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            reset();
          }}
          placeholder="Customer, email or ADM- reference"
          className={`${inputCls} min-w-[240px] flex-1 border-ink`}
        />
        <select
          aria-label="Event"
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value);
            reset();
          }}
          className={inputCls}
        >
          <option value="">All events</option>
          {events.data?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Payment status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            reset();
          }}
          className={inputCls}
        >
          <option value="">Payment: any</option>
          {(Object.keys(BOOKING) as BookingStatus[]).map((s) => (
            <option key={s} value={s}>
              {BOOKING[s].label}
            </option>
          ))}
        </select>
      </div>
      <QueryState query={list}>
        {(d) => (
          <div>
            <TableWrap min={1000}>
              <HeadRow>
                <Th>Reference</Th>
                <Th>Customer</Th>
                <Th>Event</Th>
                <Th right>Qty</Th>
                <Th right>Total</Th>
                <Th>Booked</Th>
                <Th>Payment</Th>
                <Th />
              </HeadRow>
              <tbody>
                {d.items.length === 0 ? <EmptyRow cols={8}>No bookings match.</EmptyRow> : null}
                {d.items.map((b: BookingSummary) => (
                  <tr
                    key={b.id}
                    onClick={() => setParams({ b: b.id })}
                    className="cursor-pointer border-b border-rule-soft hover:bg-paper"
                  >
                    <Td mono>
                      <button
                        className="bg-transparent p-0 font-mono text-[13px] underline decoration-rule-strong"
                        onClick={(e) => {
                          e.stopPropagation();
                          setParams({ b: b.id });
                        }}
                      >
                        {b.ref}
                      </button>
                    </Td>
                    <Td>
                      <span className="font-semibold">{b.customerName}</span>
                      <br />
                      <span className="text-xs text-muted">{b.email}</span>
                    </Td>
                    <Td className="max-w-[220px] truncate">{b.eventTitle}</Td>
                    <Td right mono>
                      {b.ticketCount}
                    </Td>
                    <Td right mono>
                      {moneyShort(b.totalMinor, b.currency)}
                    </Td>
                    <Td mono className="text-xs text-ink-2">
                      {fmtStamp(b.createdAt)}
                    </Td>
                    <Td>
                      <Badge status={BOOKING[b.status]} />
                    </Td>
                    <Td right className="text-ink-2">
                      ›
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pager total={d.total} limit={LIMIT} offset={offset} onOffset={setOffset} />
          </div>
        )}
      </QueryState>
      {open ? <BookingDrawer id={open} onClose={() => setParams({})} /> : null}
    </>
  );
}

function Label({ children }: { children: string }) {
  return <span className="label mb-2 block text-ink-2">{children}</span>;
}

export function BookingDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin", "booking", id],
    queryFn: () => adminApi.bookings.get(id),
  });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const cancel = useMutation({
    mutationFn: () => adminApi.bookings.cancel(id, reason.trim()),
    onSuccess: () => {
      setCancelOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin"] });
    },
  });
  const retry = useMutation({
    mutationFn: (mid: string) => adminApi.emails.retry(mid),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "booking", id] }),
  });
  const revoke = useMutation({
    mutationFn: (v: { id: string; reason: string }) => adminApi.tickets.revoke(v.id, v.reason),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin"] }),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !cancelOpen && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, cancelOpen]);

  return (
    <>
      <div role="presentation" onClick={onClose} className="fixed inset-0 z-[15] bg-ink/35" />
      <aside
        role="dialog"
        aria-label="Booking details"
        className="fixed inset-y-0 right-0 z-[16] flex w-[min(560px,100%)] flex-col overflow-y-auto bg-surface shadow-[-20px_0_50px_-20px_rgba(0,0,0,0.4)]"
      >
        <QueryState query={q}>
          {(b) => (
            <>
              <div className="sticky top-0 flex flex-col gap-2 border-b border-ink bg-surface px-[22px] py-[18px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[15px] font-semibold">{b.ref}</span>
                  <button
                    aria-label="Close"
                    onClick={onClose}
                    className="size-9 rounded-sm border border-rule-strong bg-surface"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge size="md" status={BOOKING[b.status]} />
                  {b.tickets.length ? (
                    <Badge
                      size="md"
                      status={{
                        tone: "ok",
                        glyph: "✓",
                        label: `${b.tickets.filter((t) => t.status !== "REVOKED").length} tickets issued`,
                      }}
                    />
                  ) : null}
                  {b.emails.length ? (
                    <Badge size="md" status={EMAIL[b.emails[b.emails.length - 1]!.status]}>
                      Email · {EMAIL[b.emails[b.emails.length - 1]!.status].label}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-rule px-[22px] py-[18px] text-[13px]">
                <div className="flex flex-col gap-0.5">
                  <span className="label text-muted">Customer</span>
                  <span className="text-sm font-semibold">{b.customer.name}</span>
                  <span>{b.customer.email}</span>
                  <span>{b.customer.phone}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="label text-muted">Event</span>
                  <span className="text-sm font-semibold">{b.event.title}</span>
                  <span>{fmtStamp(b.event.startsAt)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="label text-muted">Payment</span>
                  <span className="font-mono text-sm font-semibold">
                    {money(b.totalMinor, b.currency)}
                  </span>
                  {b.submissions.map((s) => (
                    <span key={s.id}>
                      <Badge status={SUBMISSION[s.status]} />{" "}
                      {s.txnId ? <span className="font-mono text-xs">txn {s.txnId}</span> : null}
                    </span>
                  ))}
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="label text-muted">Lines</span>
                  {b.lines.map((l) => (
                    <span key={l.ticketTypeId}>
                      {l.quantity} × {l.name}{" "}
                      <span className="font-mono">{moneyShort(l.totalMinor, b.currency)}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="border-b border-rule px-[22px] py-4">
                <Label>Tickets</Label>
                {b.tickets.length === 0 ? (
                  <p className="text-[13px] text-ink-2">
                    None issued{" "}
                    {b.status === "CONFIRMED"
                      ? ""
                      : "- tickets are issued only after payment is approved."}
                  </p>
                ) : null}
                {b.tickets.map((t) => (
                  <div
                    key={t.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-t border-rule-soft py-2.5 text-[13px]"
                  >
                    <span className="font-semibold">
                      {t.holderName} · {t.ticketType}
                    </span>
                    <Badge status={TICKET[t.status]} />
                    <span className="font-mono text-xs text-ink-2">{t.id}</span>
                    <span className="text-xs text-muted">
                      {t.status === "USED"
                        ? `Checked in ${fmtStamp(t.checkedInAt!)}${t.checkedInGate ? ` · ${t.checkedInGate}` : ""}`
                        : t.status === "REVOKED"
                          ? `Revoked${t.revokedReason ? `: ${t.revokedReason}` : ""}`
                          : "Not checked in"}
                    </span>
                    {t.status === "VALID" && can("revoke:ticket") ? (
                      <button
                        className="col-span-2 mt-1 self-start text-xs font-semibold text-bad-solid underline"
                        onClick={() => setRevokeId(t.id)}
                      >
                        Revoke ticket…
                      </button>
                    ) : null}
                  </div>
                ))}
                {revoke.isError ? (
                  <p role="alert" className="mt-2 text-xs text-bad-solid">
                    {errorText(revoke.error)}
                  </p>
                ) : null}
              </div>
              <div className="border-b border-rule px-[22px] py-4">
                <Label>Emails</Label>
                {b.emails.length === 0 ? (
                  <p className="text-[13px] text-ink-2">None sent.</p>
                ) : null}
                {b.emails.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 border-t border-rule-soft py-2 text-[13px]"
                  >
                    <span>
                      {EMAIL_TYPE_LABEL[e.type]}{" "}
                      <span className="text-xs text-muted">· {fmtStamp(e.createdAt)}</span>
                      {e.lastError ? (
                        <span className="block text-xs text-bad-fg">{e.lastError}</span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge status={EMAIL[e.status]} />
                      {e.status === "FAILED" && can("retry:email") ? (
                        <Button
                          size="sm"
                          variant="ink"
                          loading={retry.isPending}
                          onClick={() => retry.mutate(e.id)}
                        >
                          Retry
                        </Button>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-b border-rule px-[22px] py-4">
                <Label>Timeline</Label>
                {b.timeline.map((t, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[104px_1fr] gap-3 border-l-2 border-rule py-1.5 pl-3 ml-1 text-[13px]"
                  >
                    <span className="font-mono text-[11px] text-muted">{fmtStamp(t.at)}</span>
                    <span>
                      <strong className="font-semibold">{t.step}</strong>
                      {t.note ? <span className="text-ink-2"> · {t.note}</span> : null}
                    </span>
                  </div>
                ))}
              </div>
              {can("cancel:booking") &&
              (b.status === "AWAITING_PAYMENT" ||
                b.status === "IN_REVIEW" ||
                b.status === "CONFIRMED") ? (
                <div className="px-[22px] py-4">
                  <Button variant="danger" size="md" onClick={() => setCancelOpen(true)}>
                    Cancel booking &amp; revoke…
                  </Button>
                </div>
              ) : null}
              <ReasonDialog
                open={!!revokeId}
                onClose={() => setRevokeId(null)}
                title="Revoke this ticket?"
                body="Its QR stops working at the door from the next scan. Use this for a refund, a holder change or fraud. Tickets are never deleted."
                confirmLabel="Revoke ticket"
                busy={revoke.isPending}
                onConfirm={(r) => {
                  revoke.mutate({ id: revokeId!, reason: r });
                  setRevokeId(null);
                }}
              />
              <Dialog
                open={cancelOpen}
                onClose={() => setCancelOpen(false)}
                title={`Cancel ${b.ref}?`}
              >
                <div className="flex flex-col gap-3 px-[22px] pt-2.5">
                  <p className="text-sm leading-normal text-ink-2">
                    The seats go back on sale, every ticket on this booking is revoked at the door,
                    and the customer is emailed. Refunds happen outside Admit.
                  </p>
                  <TextArea
                    label="Reason (kept in the audit log)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  {cancel.isError ? (
                    <p role="alert" className="text-sm text-bad-solid">
                      {errorText(cancel.error)}
                    </p>
                  ) : null}
                </div>
                <div className="flex justify-end gap-2 p-[22px]">
                  <Button variant="secondary" size="md" onClick={() => setCancelOpen(false)}>
                    Keep booking
                  </Button>
                  <Button
                    variant="ink"
                    size="md"
                    loading={cancel.isPending}
                    disabled={reason.trim().length < 3}
                    onClick={() => cancel.mutate()}
                  >
                    Cancel booking
                  </Button>
                </div>
              </Dialog>
            </>
          )}
        </QueryState>
      </aside>
    </>
  );
}
