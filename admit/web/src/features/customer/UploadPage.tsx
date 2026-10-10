import { useRef, useState, type DragEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { publicApi } from "@/api";
import type { GuestBooking } from "@/api/types";
import { Button } from "@/components/Button";
import { TextField } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { QueryState, Skeleton } from "@/components/QueryState";
import { errorText } from "@/lib/errors";
import { fileSize, money } from "@/lib/format";
import { putWithProgress } from "@/services/upload";
import { CheckoutSteps } from "./CheckoutSteps";
import { bookingPath, qk, useBookingAccess, useGuestBooking } from "./hooks";
import { Page } from "./parts";
import { BookingError } from "./StatusPage";
import { validateProof, validTxn } from "./validation";

type Stage =
  | { name: "empty" }
  | { name: "uploading"; file: File; percent: number }
  | { name: "error"; file: File; message: string }
  | { name: "done"; file: File; fileId: string };

export function UploadPage() {
  const q = useGuestBooking();
  const { org, ref, k } = useBookingAccess();
  // once the proof is in, the booking is no longer "awaiting payment"; that must not bounce this page to the status page before the
  // person is taken to the "proof received" page
  const [submitted, setSubmitted] = useState(false);
  if (!k) return <BookingError />;
  return (
    <QueryState query={q} skeleton={<Page narrow="xs"><Skeleton className="h-64 w-full" /></Page>}>
      {(b) => (b.status === "AWAITING_PAYMENT" || submitted ? <Upload b={b} onSubmitted={() => setSubmitted(true)} /> : <Navigate to={bookingPath(org, ref, k)} replace />)}
    </QueryState>
  );
}

function Upload({ b, onSubmitted }: { b: GuestBooking; onSubmitted: () => void }) {
  const { org, ref, k } = useBookingAccess();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>({ name: "empty" });
  const [fileError, setFileError] = useState<string | null>(null);
  const [txn, setTxn] = useState("");
  const [sentFrom, setSentFrom] = useState(b.customer.emailMasked ? "" : "");
  const [methodId, setMethodId] = useState(b.paymentMethods[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  const start = async (file: File) => {
    const problem = validateProof(file);
    if (problem) {
      setFileError(problem);
      return;
    }
    setFileError(null);
    setSubmitError(null);
    setStage({ name: "uploading", file, percent: 0 });
    try {
      const contentType = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : /\.hei[cf]$/i.test(file.name) ? "image/heic" : "image/jpeg");
      const pre = await publicApi.presignProof(org, ref, k, { fileName: file.name, contentType, byteSize: file.size });
      await putWithProgress({ ...pre.upload, headers: pre.upload.headers }, file, (percent) => setStage({ name: "uploading", file, percent }));
      setStage({ name: "done", file, fileId: pre.fileId });
    } catch (err) {
      setStage({ name: "error", file, message: err instanceof Error && err.message === "network" ? "The connection dropped. Nothing was submitted. Your file is still selected — try again, or pick a smaller file if you are on mobile data." : errorText(err) });
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) void start(f);
  };

  const submit = async () => {
    if (stage.name !== "done" || submitting) return;
    if (!validTxn(txn)) return setSubmitError("Transaction ID must be 4-40 characters.");
    setSubmitting(true);
    setSubmitError(null);
    try {
      await publicApi.submitProof(org, ref, k, { fileId: stage.fileId, methodId: methodId || null, transactionId: txn.trim() || null, sentFrom: sentFrom.trim() || null, amountMinor: b.totalMinor });
      onSubmitted();
      await qc.invalidateQueries({ queryKey: qk.booking(org, ref) });
      nav(bookingPath(org, ref, k, "submitted"), { replace: true });
    } catch (err) {
      setSubmitError(errorText(err));
      setSubmitting(false);
    }
  };

  const ready = stage.name === "done" && !submitting;
  return (
    <>
      <CheckoutSteps step={3} />
      <Page narrow="xs" className="flex flex-col gap-5">
        <h1 className="display text-5xl">Upload proof of payment</h1>
        <div className="flex flex-wrap justify-between gap-2 border-b border-rule border-t-ink py-2.5 text-sm text-ink-2" style={{ borderTopWidth: 1, borderTopColor: "var(--color-ink)" }}>
          <span className="font-mono">{b.ref}</span>
          <span>
            Total <strong className="font-mono text-ink">{money(b.totalMinor, b.currency)}</strong>
          </span>
        </div>
        {b.rejectionReason ? <Notice tone="bad"><strong>Your last proof was not accepted.</strong> {b.rejectionReason}</Notice> : null}

        {stage.name === "empty" ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center gap-3.5 rounded-lg px-5 py-10 text-center ${drag ? "border-[1.5px] border-solid border-ink bg-brand-tint" : "border-[1.5px] border-dashed border-faint bg-surface"}`}
          >
            <span className="text-[17px] font-semibold">{drag ? "Release to upload" : "Drag your screenshot here"}</span>
            <span className="text-sm text-ink-2">or</span>
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button variant="ink" onClick={() => input.current?.click()}>Choose from files</Button>
              <Button variant="secondary" onClick={() => camera.current?.click()}>Take photo</Button>
            </div>
            <span className="text-xs text-muted">JPG, PNG, HEIC or PDF · up to 10 MB · one file</span>
            <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/heic,image/heif,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void start(f); }} data-testid="proof-input" />
            <input ref={camera} type="file" hidden accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void start(f); }} />
          </div>
        ) : null}
        {fileError ? <p role="alert" className="text-sm font-medium text-bad-solid">✕ {fileError}</p> : null}

        {stage.name === "uploading" ? (
          <div role="status" aria-busy="true" className="flex items-center gap-4 rounded-lg border border-rule-strong bg-surface p-5">
            <div className="stripes h-[84px] w-16 flex-none" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span>{stage.file.name} · {fileSize(stage.file.size)}</span>
                <span className="font-mono">{stage.percent}%</span>
              </div>
              <div className="h-1.5 rounded-sm bg-sunken"><div className="h-1.5 rounded-sm bg-ink transition-[width]" style={{ width: `${stage.percent}%` }} /></div>
              <span className="text-xs text-muted">Uploading. Keep this page open.</span>
            </div>
          </div>
        ) : null}

        {stage.name === "error" ? (
          <div role="alert" className="flex flex-col gap-3 rounded-lg border border-bad-line bg-bad-bg p-5 text-bad-ink">
            <span className="text-base font-bold">✕ Upload did not finish</span>
            <span className="text-sm leading-normal">{stage.message}</span>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="ink" size="md" onClick={() => void start(stage.file)}>Try again</Button>
              <Button variant="secondary" size="md" onClick={() => setStage({ name: "empty" })}>Choose another file</Button>
            </div>
          </div>
        ) : null}

        {stage.name === "done" || submitting ? (
          <div className="grid gap-4 rounded-lg border border-ink bg-surface p-4 sm:grid-cols-[140px_minmax(0,1fr)]">
            <div className="stripes flex aspect-[9/16] items-end p-1.5 font-mono text-[10px] text-muted">your receipt</div>
            <div className="flex min-w-0 flex-col gap-2.5">
              <span className="text-sm font-semibold text-ok-fg">✓ Uploaded · {stage.name !== "empty" ? stage.file.name : ""}</span>
              <span className="text-[13px] text-ink-2">{stage.name !== "empty" ? fileSize(stage.file.size) : ""} · not yet submitted</span>
              <div className="flex flex-wrap gap-2">
                <Button size="md" variant="secondary" onClick={() => setStage({ name: "empty" })} disabled={submitting}>Replace</Button>
                <Button size="md" variant="danger" onClick={() => setStage({ name: "empty" })} disabled={submitting}>Remove</Button>
              </div>
              {b.paymentMethods.length > 1 ? (
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  Paid with
                  <select value={methodId} onChange={(e) => setMethodId(e.target.value)} className="h-11 rounded-sm border border-rule-strong bg-surface px-3 text-[15px] font-normal">
                    {b.paymentMethods.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
                  </select>
                </label>
              ) : null}
              <TextField label={<>Transaction ID <span className="font-normal text-muted">(optional, speeds up review)</span></>} mono value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="e.g. 4829 1150 33" className="h-11" error={validTxn(txn) ? null : "Transaction ID must be 4-40 characters."} />
              <TextField label={<>Sent from <span className="font-normal text-muted">(name or number on the sending account)</span></>} value={sentFrom} onChange={(e) => setSentFrom(e.target.value)} className="h-11" />
            </div>
          </div>
        ) : null}

        {submitError ? <Notice tone="bad">{submitError}</Notice> : null}
        <Button size="lg" block className="h-[52px] text-base" disabled={!ready} loading={submitting} onClick={() => void submit()}>
          {submitting ? "Submitting…" : "Submit for verification"}
        </Button>
        <span className="text-center text-[13px] leading-normal text-ink-2">Submitting sends your proof for review. It does not confirm the payment — the organizer does that after checking their account.</span>
      </Page>
    </>
  );
}
