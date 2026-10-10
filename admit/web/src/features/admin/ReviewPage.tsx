import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api";
import type { DecisionResult, EmailStatus, PaymentDetail, QueueItem } from "@/api/types";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Dialog } from "@/components/Dialog";
import { TextArea } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { errorText } from "@/lib/errors";
import { age, fmtStamp, money, plural } from "@/lib/format";
import { EMAIL } from "@/lib/status";
import { ApiError } from "@/services/http";
import { Forbidden } from "./AdminApp";
import { useAuth } from "./auth";
import { Evidence } from "./Evidence";
import { REJECT_REASONS } from "./reject-reasons";

const newKey = () => `rv-${crypto.randomUUID().replaceAll("-", "")}`;

type Panel = "idle" | "reject" | "confirm" | "result";

export function ReviewPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const queue = useQuery({
    queryKey: ["admin", "queue"],
    queryFn: () => adminApi.payments.queue(),
    enabled: can("read:payment"),
    refetchInterval: 20_000,
  });
  const [eventFilter, setEventFilter] = useState("");
  const selectedId = params.get("s");

  const items = useMemo(
    () => (queue.data ?? []).filter((i) => !eventFilter || i.eventId === eventFilter),
    [queue.data, eventFilter],
  );
  const events = useMemo(
    () => [...new Map((queue.data ?? []).map((i) => [i.eventId, i.eventTitle]))],
    [queue.data],
  );
  // A payment I just decided leaves the queue at once, but its result (tickets, email) must stay on screen until I move on.
  const [pinned, setPinned] = useState<QueueItem | null>(null);
  const current =
    items.find((i) => i.submissionId === selectedId) ??
    (pinned && pinned.submissionId === selectedId ? pinned : null);
  const [gone, setGone] = useState<QueueItem | null>(null);

  // An item decided elsewhere leaves the queue; say so in one line rather than letting it vanish silently.
  const lastSeen = useRef<QueueItem | null>(null);
  useEffect(() => {
    if (current) lastSeen.current = current;
    else if (
      selectedId &&
      lastSeen.current?.submissionId === selectedId &&
      queue.data &&
      pinned?.submissionId !== selectedId
    )
      setGone(lastSeen.current);
  }, [current, selectedId, queue.data, pinned]);

  if (!can("read:payment")) return <Forbidden needs="read:payment" />;
  const select = (id: string | null) => {
    setGone(null);
    setPinned(null);
    setParams(id ? { s: id } : {}, { replace: true });
  };
  return (
    <>
      <h1 className="sr-only">Payment review</h1>
      <div className="overflow-x-auto border border-ink">
        <div className="grid min-h-[720px] min-w-[960px] grid-cols-[minmax(240px,300px)_minmax(340px,1fr)_minmax(320px,380px)] bg-surface">
          <div className="flex min-w-0 flex-col border-r border-rule-strong">
            <div className="flex flex-col gap-2 border-b border-rule p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">Awaiting review</span>
                <span className="font-mono text-xs text-ink-2" aria-label="in queue">
                  {queue.data?.length ?? 0}
                </span>
              </div>
              <select
                aria-label="Filter by event"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="h-[34px] rounded-sm border border-rule-strong bg-surface px-2 text-[13px]"
              >
                <option value="">All events · oldest first</option>
                {events.map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </div>
            {queue.isPending ? (
              <p className="p-4 text-sm text-ink-2" role="status">
                Loading…
              </p>
            ) : null}
            {queue.isError ? (
              <p role="alert" className="p-4 text-sm text-bad-fg">
                ✕ {errorText(queue.error)}
              </p>
            ) : null}
            {queue.data && items.length === 0 ? (
              <p className="p-4 text-sm text-ink-2">✓ Nothing is waiting for review.</p>
            ) : null}
            {items.map((q) => (
              <button
                key={q.submissionId}
                aria-current={q.submissionId === selectedId}
                onClick={() => select(q.submissionId)}
                className={`flex flex-col gap-1 border-b border-l-[3px] border-b-rule-soft px-3.5 py-3 text-left ${q.submissionId === selectedId ? "border-l-ink bg-paper" : "border-l-transparent bg-surface"}`}
              >
                <span className="flex justify-between gap-2">
                  <span className="text-sm font-semibold">{q.customer}</span>
                  <span className="font-mono text-[13px] font-semibold">
                    {money(q.amountMinor, q.currency)}
                  </span>
                </span>
                <span className="truncate text-xs text-ink-2">{q.eventTitle}</span>
                <span className="flex justify-between gap-2 font-mono text-[11px] text-muted">
                  <span>
                    {q.bookingRef}
                    {q.method ? ` · ${q.method}` : ""}
                  </span>
                  <span>{age(q.submittedAt)}</span>
                </span>
                {q.flags.map((f) => (
                  <span key={f} className="text-[11px] font-semibold text-used-fg">
                    !{" "}
                    {f === "amount_mismatch"
                      ? "Declared amount differs from the total"
                      : f === "duplicate_transaction"
                        ? "Transaction ID used on another booking"
                        : "Resubmission"}
                  </span>
                ))}
                {q.lock ? (
                  <span className="text-[11px] font-semibold text-info-fg">
                    i Another reviewer has this open
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {current ? (
            <Workbench
              key={current.submissionId}
              item={current}
              onNext={() => {
                const i = items.findIndex((x) => x.submissionId === current.submissionId);
                select(items[(i + 1) % items.length]?.submissionId ?? null);
                void qc.invalidateQueries({ queryKey: ["admin", "queue"] });
              }}
              onDecided={() => {
                setPinned(current);
                void qc.invalidateQueries({ queryKey: ["admin", "queue"] });
              }}
            />
          ) : (
            <div className="col-span-2 flex flex-col items-center justify-center gap-2 bg-paper p-10 text-center">
              {gone ? (
                <Notice tone="info">
                  {gone.customer} ({gone.bookingRef}) was decided by someone else and has left the
                  queue.
                </Notice>
              ) : null}
              <p className="display-l text-3xl">
                {items.length ? "Choose a payment to review" : "All caught up"}
              </p>
              <p className="max-w-sm text-sm text-ink-2">
                Compare the proof with the amount and recipient, tick the four checks, then approve.
                Approving confirms the money arrived, not just that a screenshot exists.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Workbench({
  item,
  onNext,
  onDecided,
}: {
  item: QueueItem;
  onNext: () => void;
  onDecided: () => void;
}) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["admin", "payment", item.submissionId],
    queryFn: () => adminApi.payments.get(item.submissionId),
    retry: false,
  });
  const booking = useQuery({
    queryKey: ["admin", "booking", item.bookingId],
    queryFn: () => adminApi.bookings.get(item.bookingId),
    enabled: can("read:booking"),
    refetchInterval: (q) =>
      q.state.data?.status === "CONFIRMED" &&
      q.state.data.emails.some(
        (e) => e.type === "TICKETS" && (e.status === "QUEUED" || e.status === "RETRYING"),
      )
        ? 3000
        : false,
  });
  const [checks, setChecks] = useState([false, false, false, false]);
  const [panel, setPanel] = useState<Panel>("idle");
  const [reason, setReason] = useState(0);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ApiError | null>(null);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const key = useRef(newKey());

  // Soft lock: advisory only (the version check on decide is the real protection). Heartbeat while open, release on leaving.
  useEffect(() => {
    let alive = true;
    const beat = () =>
      adminApi.payments.claim(item.submissionId).then(
        (c) => alive && setLockedBy(c.heldByMe ? null : (c.claimedBy ?? "another reviewer")),
        () => undefined,
      );
    void beat();
    const t = setInterval(() => void beat(), 60_000);
    return () => {
      alive = false;
      clearInterval(t);
      void adminApi.payments.release(item.submissionId).catch(() => undefined);
    };
  }, [item.submissionId]);

  const decide = useMutation({
    mutationFn: async (kind: "approve" | "reject") => {
      const version = detail.data?.version ?? item.version;
      return kind === "approve"
        ? adminApi.payments.approve(item.submissionId, {
            version,
            idempotencyKey: key.current,
            internalNote: note || null,
          })
        : adminApi.payments.reject(item.submissionId, {
            version,
            idempotencyKey: key.current,
            reason: text.trim(),
            internalNote: note || null,
          });
    },
    onSuccess: (r, kind) => {
      setResult(r);
      setRejected(kind === "reject" ? text.trim() : null);
      setPanel("result");
      setConflict(null);
      onDecided();
      void qc.invalidateQueries({ queryKey: ["admin", "booking", item.bookingId] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "admit.payment_changed") {
        setConflict(err);
        setPanel("idle");
      }
    },
  });

  const d = detail.data;
  const bk = booking.data;
  const total = money(item.amountMinor, item.currency);
  const labels = [
    `Amount on screenshot = ${total}`,
    `Recipient = the account in the payment method${item.method ? ` (${item.method})` : ""}`,
    `Transfer dated after the booking${bk ? ` (${fmtStamp(bk.createdAt)})` : ""}`,
    `I found this transfer in our ${item.method ?? "payment"} account`,
  ];
  const all = checks.every(Boolean);
  const blocked = !!lockedBy || decide.isPending;
  const canApprove = can("approve:payment");
  const canReject = can("reject:payment");

  return (
    <>
      <Evidence submissionId={item.submissionId} detail={d} />
      <div className="flex min-w-0 flex-col border-l border-rule-strong">
        {lockedBy ? (
          <div
            role="status"
            className="border-b border-[#c7d5f3] bg-info-bg px-4 py-2.5 text-[13px] text-[#1f3f8f]"
          >
            i Another reviewer has this booking open. You can look, but decisions are held until
            they finish.
          </div>
        ) : null}
        {conflict ? (
          <div
            role="alert"
            className="border-b border-used-line bg-used-bg px-4 py-3 text-[13px] leading-snug text-used-ink"
          >
            <strong>! This booking changed.</strong> {conflictLine(conflict)} Your decision was not
            applied.{" "}
            <button className="font-semibold underline" onClick={onNext}>
              Next in queue
            </button>
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5 border-b border-rule p-4">
          <span className="font-mono text-[13px] text-ink-2">{item.bookingRef}</span>
          <span className="text-lg font-semibold">{item.customer}</span>
          {bk ? (
            <span className="text-[13px] text-ink-2">
              {bk.customer.email} · {bk.customer.phone}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 border-b border-rule bg-paper p-4">
          <span className="label tracking-widest text-ink-2">
            Expected · compare with screenshot
          </span>
          <span
            className="font-mono text-[34px] font-semibold leading-tight"
            data-testid="expected"
          >
            {total}
          </span>
          <span className="text-[13px] text-ink-2">
            {item.method ? (
              <>
                via <strong className="text-ink">{item.method}</strong>
              </>
            ) : (
              "method not stated"
            )}
          </span>
          {bk ? (
            <span className="text-[13px] text-ink-2">
              Booked {fmtStamp(bk.createdAt)} · hold expires {fmtStamp(bk.holdExpiresAt)}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 border-b border-rule px-4 py-3.5 text-[13px]">
          <span className="font-semibold">{item.eventTitle}</span>
          <span className="text-ink-2">
            {bk ? bk.lines.map((l) => `${l.quantity} × ${l.name}`).join(" · ") : ""}
          </span>
        </div>

        {panel === "idle" ? (
          <div className="flex flex-1 flex-col gap-2.5 p-4">
            <span className="label text-ink-2">Before approving</span>
            {labels.map((l, i) => (
              <label
                key={i}
                className={`flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug ${i === 3 ? "font-semibold" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checks[i]}
                  onChange={() => setChecks((c) => c.map((v, j) => (j === i ? !v : v)))}
                  className="mt-px size-[18px] flex-none accent-ink"
                />
                {l}
              </label>
            ))}
            <p className="border-t border-dashed border-rule-strong pt-2.5 text-xs leading-snug text-ink-2">
              Approving confirms the money arrived in your account, not just that a screenshot
              exists. Tickets are issued and emailed immediately and cannot be un-issued, only
              revoked.
            </p>
            <div className="mt-auto grid grid-cols-[1fr_1.4fr] gap-2">
              {canReject ? (
                <Button
                  variant="danger"
                  disabled={blocked}
                  onClick={() => {
                    setReason(0);
                    setText(REJECT_REASONS[0]!.text);
                    setPanel("reject");
                  }}
                >
                  Reject…
                </Button>
              ) : (
                <span />
              )}
              {canApprove ? (
                <Button
                  variant="ink"
                  disabled={!all || blocked}
                  onClick={() => setPanel("confirm")}
                >
                  Approve payment
                </Button>
              ) : null}
            </div>
            <span className="text-center text-[11px] text-muted">
              {lockedBy
                ? "Locked while another reviewer has this booking open"
                : !canApprove
                  ? "Your role can look at payments but not decide them"
                  : all
                    ? "Opens a confirmation"
                    : "Tick all four checks to enable approval"}
            </span>
          </div>
        ) : null}

        {panel === "reject" ? (
          <div className="flex flex-1 flex-col gap-2.5 p-4">
            <span className="text-sm font-semibold text-bad-fg">Reject payment</span>
            <span className="text-xs text-ink-2">
              The customer sees the reason. Seats stay held until the original deadline so they can
              resubmit.
            </span>
            <div role="radiogroup" aria-label="Reason" className="flex flex-col gap-1.5">
              {REJECT_REASONS.map((r, i) => (
                <button
                  key={r.label}
                  role="radio"
                  aria-checked={i === reason}
                  onClick={() => {
                    setReason(i);
                    setText(r.text);
                  }}
                  className={`min-h-10 rounded-sm bg-surface px-3 py-2 text-left text-[13px] font-medium ${i === reason ? "border-2 border-ink" : "border border-rule-strong"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <TextArea
              label="Message to customer"
              value={text}
              onChange={(e) => setText(e.target.value)}
              error={
                text.trim().length > 0 && text.trim().length < 10
                  ? "Tell the customer what to fix (at least 10 characters)."
                  : null
              }
            />
            <TextArea
              label="Internal note (staff only)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-14"
            />
            {decide.isError && !conflict ? (
              <Notice tone="bad">{errorText(decide.error)}</Notice>
            ) : null}
            <div className="mt-auto grid grid-cols-[1fr_1.4fr] gap-2">
              <Button variant="secondary" onClick={() => setPanel("idle")}>
                Back
              </Button>
              <Button
                variant="primary"
                className="bg-bad-solid hover:bg-bad-fg"
                loading={decide.isPending}
                disabled={text.trim().length < 10 || text.trim().length > 500}
                onClick={() => decide.mutate("reject")}
              >
                Reject &amp; notify
              </Button>
            </div>
          </div>
        ) : null}

        {panel === "result" && result ? (
          <ResultPanel
            result={result}
            rejected={rejected}
            item={item}
            bookingEmails={bk?.emails ?? []}
            onNext={onNext}
          />
        ) : null}

        <div className="border-t border-rule bg-[#fbfaf7] px-4 py-3 text-xs text-ink-2">
          <span className="font-semibold text-ink">Submission</span>
          <div className="mt-1">
            {d ? (
              <>
                Txn ID <span className="font-mono text-ink">{d.txnId ?? "none given"}</span> · sent
                from {d.sentFrom ?? "not stated"}
              </>
            ) : (
              "Loading…"
            )}
          </div>
          {d && d.history.length > 1 ? (
            <div className="mt-1">
              Previous proofs: {d.history.length - 1} (
              {d.history.filter((h) => h.status === "REJECTED").length} rejected)
            </div>
          ) : (
            <div className="mt-1">Previous proofs: none</div>
          )}
        </div>
      </div>

      <Dialog
        open={panel === "confirm"}
        onClose={() => setPanel("idle")}
        title={`Approve ${total} from ${item.customer}?`}
      >
        <p className="px-[22px] pt-2.5 text-sm leading-normal text-ink-2">
          You confirm this transfer is in the organizer's {item.method ?? "payment"} account. This
          issues{" "}
          <strong className="text-ink">
            {bk ? plural(bk.lines.reduce((n, l) => n + l.quantity, 0), "ticket") : "the tickets"}
          </strong>{" "}
          for {item.eventTitle} and emails them to the customer.
        </p>
        <div className="mx-[22px] mt-4 flex justify-between bg-paper p-3 font-mono text-[13px]">
          <span>{item.bookingRef}</span>
          <span>{total}</span>
        </div>
        {decide.isError && !conflict ? (
          <p role="alert" className="px-[22px] pt-3 text-sm text-bad-solid">
            {errorText(decide.error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 p-[22px]">
          <Button variant="secondary" size="md" onClick={() => setPanel("idle")}>
            Cancel
          </Button>
          <Button
            variant="ink"
            size="md"
            loading={decide.isPending}
            onClick={() => decide.mutate("approve")}
          >
            Approve &amp; issue tickets
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function conflictLine(e: ApiError): string {
  const status = String((e as unknown as { details?: { status?: string } }).details?.status ?? "");
  return status && status !== "SUBMITTED"
    ? `It was already ${status.toLowerCase()} by someone else.`
    : "Someone else decided it while you were reviewing.";
}

/** What the server reported after the decision. Nothing here is assumed: tickets come from the response, the email from the booking record (polled). */
function ResultPanel({
  result,
  rejected,
  item,
  bookingEmails,
  onNext,
}: {
  result: DecisionResult;
  rejected: string | null;
  item: QueueItem;
  bookingEmails: { type: string; status: EmailStatus; lastError: string | null; id: string }[];
  onNext: () => void;
}) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const retry = useMutation({
    mutationFn: (id: string) => adminApi.emails.retry(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "booking", item.bookingId] }),
  });
  const email = [...bookingEmails]
    .reverse()
    .find((e) => e.type === (rejected ? "REJECTED" : "TICKETS"));
  const step = (
    done: boolean,
    glyph: string,
    label: string,
    detail: string,
    tone: "ok" | "bad" | "pending" | "info" = "ok",
  ) => (
    <li
      key={label}
      className="grid grid-cols-[24px_minmax(0,1fr)] items-center gap-2.5 border-b border-rule-soft py-2.5"
    >
      <span
        aria-hidden="true"
        className={`flex size-[22px] items-center justify-center rounded-full text-[11px] font-bold ${done ? (tone === "bad" ? "bg-bad-solid text-white" : tone === "info" ? "bg-info-bg text-info-fg" : "bg-ok-solid text-white") : "border-2 border-pending-fg bg-pending-bg text-pending-fg"}`}
      >
        {glyph}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-ink-2">{detail}</span>
      </span>
    </li>
  );
  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col gap-3 p-4">
      <span className="label text-ink-2">
        {rejected ? "Rejected" : result.replayed ? "Already approved (same request)" : "Approved"}
      </span>
      <ol className="m-0 flex list-none flex-col p-0">
        {rejected
          ? [
              step(true, "✕", "Payment rejected", `Reason: ${rejected}`, "bad"),
              step(
                result.bookingStatus === "AWAITING_PAYMENT",
                "◷",
                result.bookingStatus === "AWAITING_PAYMENT"
                  ? "Seats held for resubmission"
                  : "Seats released",
                result.bookingStatus === "AWAITING_PAYMENT"
                  ? "The customer may upload a new proof until the hold ends"
                  : "The hold had ended",
              ),
            ]
          : [
              step(true, "✓", "Payment approved", "Recorded and audited"),
              step(
                true,
                "✓",
                `${plural(result.ticketsIssued, "ticket")} issued`,
                "Unique tokens, one per ticket",
              ),
            ]}
        {email
          ? step(
              email.status !== "QUEUED" && email.status !== "RETRYING",
              email.status === "FAILED"
                ? "✕"
                : email.status === "ACCEPTED" || email.status === "DELIVERED"
                  ? "i"
                  : "◷",
              email.status === "FAILED"
                ? "Email failed"
                : email.status === "QUEUED"
                  ? "Email queued"
                  : email.status === "RETRYING"
                    ? "Email retrying"
                    : "Accepted by provider",
              email.lastError ?? EMAIL[email.status].label,
              email.status === "FAILED" ? "bad" : "info",
            )
          : step(false, "◷", "Email queued…", "Waiting for server confirmation")}
      </ol>
      {email?.status === "FAILED" ? (
        <div className="flex flex-col gap-2 rounded-sm border border-bad-line bg-bad-bg p-3 text-[13px] leading-snug text-bad-ink">
          <span>
            <strong>
              {rejected ? "The rejection notice" : "The tickets are issued but the email"} did not
              go out.
            </strong>{" "}
            The customer cannot see {rejected ? "it" : "them"} by email yet.{" "}
            {rejected ? "" : "They can still open the booking link."}
          </span>
          {can("retry:email") ? (
            <Button
              size="sm"
              variant="ink"
              loading={retry.isPending}
              onClick={() => retry.mutate(email.id)}
            >
              Retry send
            </Button>
          ) : null}
        </div>
      ) : null}
      <Button variant="ink" className="mt-auto" onClick={onNext}>
        Next in queue →
      </Button>
      <span className="text-center text-[11px] text-muted">
        You can move on; delivery continues on the server and stays visible on this booking.
      </span>
      <Badge
        status={
          result.status === "APPROVED"
            ? { tone: "ok", glyph: "✓", label: "Booking verified" }
            : { tone: "bad", glyph: "✕", label: "Payment rejected" }
        }
      />
    </div>
  );
}

export type { PaymentDetail };
