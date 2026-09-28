import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useTicket, useTicketAction, type TicketDetail } from "@/api/operations";
import { useStaff } from "@/api/staff";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FormError, InputField, SelectField, TextAreaField } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { addIsoDays, formatDate, formatEgp, formatRelative, hotelToday } from "@/lib/format";
import { EVENT_LABEL, formatIsoDate, statusLabelOrDash } from "./labels";

type DialogKind = "assign" | "resolve" | "reopen" | "extend" | null;

/**
 * Maintenance ticket (design: "Maintenance detail"): the design's card — number, issue, room,
 * priority; assigned-to / status / created / cost — and its Workflow button row, driven by the
 * commands the server says are legal now AND the viewer's permissions. The timeline, notes, cost
 * and block extension fill the design's gaps.
 */
export function TicketDetailPage() {
  const { ticketId = "" } = useParams();
  const ticket = useTicket(ticketId);
  const [dialog, setDialog] = useState<DialogKind>(null);

  return (
    <>
      <PageHeader
        title="Maintenance ticket"
        back={{ to: "/maintenance", label: "Back to Maintenance" }}
      />
      {ticket.isLoading ? (
        <LoadingState />
      ) : ticket.error ? (
        <ErrorState error={ticket.error} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
          <TicketCard t={ticket.data!} onDialog={setDialog} />
          <Timeline t={ticket.data!} />
        </div>
      )}
      {ticket.data && dialog === "assign" ? (
        <AssignDialog t={ticket.data} onClose={() => setDialog(null)} />
      ) : null}
      {ticket.data && dialog === "resolve" ? (
        <TextDialog
          t={ticket.data}
          title="Resolve ticket"
          label="What was done? (optional)"
          action="Resolve"
          optional
          onClose={() => setDialog(null)}
          toAction={(text) => ({ kind: "resolve", notes: text || null })}
        />
      ) : null}
      {ticket.data && dialog === "reopen" ? (
        <TextDialog
          t={ticket.data}
          title="Reopen ticket"
          label="Why isn't it fixed?"
          action="Reopen"
          onClose={() => setDialog(null)}
          toAction={(text) => ({ kind: "reopen", reason: text })}
        />
      ) : null}
      {ticket.data && dialog === "extend" ? (
        <ExtendDialog t={ticket.data} onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-[3px] text-faint">{label}</div>
      <div className="font-semibold">{children}</div>
    </div>
  );
}

function TicketCard({ t, onDialog }: { t: TicketDetail; onDialog: (d: DialogKind) => void }) {
  const auth = useAuth();
  const action = useTicketAction(t.id);
  const toast = useToast();
  const supervisor = auth.can("manage:maintenance");
  const worker = auth.can("update:maintenance");
  const has = (c: string) => t.commands.includes(c as never);
  const blocking = t.roomImpact !== "none" && t.status !== "verified";

  const run = (a: Parameters<typeof action.mutate>[0], done: string) =>
    action.mutate(a, { onSuccess: () => toast(done), onError: (e) => toast(errorMessage(e)) });

  const steps = [
    supervisor &&
      has("assign") && {
        label: t.assigneeId ? "Reassign" : "Assign",
        onClick: () => onDialog("assign"),
      },
    worker &&
      has("start") && {
        label: "Start Work",
        onClick: () => run({ kind: "start" }, `${t.number} in progress`),
      },
    worker && has("resolve") && { label: "Resolve", onClick: () => onDialog("resolve") },
    supervisor &&
      has("verify") && {
        label: blocking ? "Verify & Return to Service" : "Verify",
        primary: true,
        onClick: () => run({ kind: "verify" }, `${t.number} verified`),
      },
    supervisor && has("reopen") && { label: "Reopen", onClick: () => onDialog("reopen") },
    supervisor && blocking && { label: "Extend Block", onClick: () => onDialog("extend") },
  ].filter(Boolean) as Array<{ label: string; onClick: () => void; primary?: boolean }>;

  return (
    <Card className="p-6">
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-body text-faint">{t.number}</div>
          <h2 className="m-0 mt-1 text-[18px] font-extrabold">{t.title}</h2>
          <div className="mt-0.5 text-small text-muted">
            Room {t.roomNumber} · {t.roomTypeName}
          </div>
        </div>
        <StatusBadge status={t.priority} />
      </div>
      {t.description ? (
        <p className="m-0 mb-3.5 text-small text-ink-soft">{t.description}</p>
      ) : null}
      <div className="mb-[18px] grid grid-cols-2 gap-3.5 border-y border-border-subtle py-3.5 text-small">
        <Detail label="Assigned to">{t.assigneeName ?? "Unassigned"}</Detail>
        <Detail label="Status">
          <StatusBadge status={t.status} />
        </Detail>
        <Detail label="Created">{formatDate(t.createdAt)}</Detail>
        <Detail label="Cost">{t.cost > 0 ? formatEgp(t.cost) : "—"}</Detail>
        <Detail label="Room impact">
          {statusLabelOrDash(t.roomImpact === "none" ? "stays_on_sale" : t.roomImpact)}
        </Detail>
        <Detail label="Expected back">
          {t.expectedBack ? formatIsoDate(t.expectedBack, true) : "—"}
        </Detail>
        {t.reportedByName ? <Detail label="Reported by">{t.reportedByName}</Detail> : null}
      </div>
      {steps.length > 0 ? (
        <>
          <div className="mb-2 text-small font-bold">Workflow</div>
          <div className="flex flex-wrap gap-2">
            {steps.map((s) => (
              <Button
                key={s.label}
                size="sm"
                variant={s.primary ? "primary" : "secondary"}
                className="!px-3.5 !py-2 text-label"
                disabled={action.isPending}
                onClick={s.onClick}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </>
      ) : null}
      {worker && t.status !== "verified" ? <CostForm t={t} /> : null}
      {t.resolutionNotes ? (
        <p className="m-0 mt-4 rounded-inner bg-success-soft px-3.5 py-2.5 text-small text-success">
          {t.resolutionNotes}
        </p>
      ) : null}
    </Card>
  );
}

function CostForm({ t }: { t: TicketDetail }) {
  const action = useTicketAction(t.id);
  const toast = useToast();
  const [cost, setCost] = useState(String(t.cost || ""));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    action.mutate(
      { kind: "cost", cost: Number(cost) || 0 },
      { onSuccess: () => toast("Cost saved"), onError: (err) => toast(errorMessage(err)) },
    );
  };
  return (
    <form onSubmit={submit} className="mt-4 flex items-end gap-2" noValidate>
      <InputField
        label="Repair cost (EGP)"
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        className="flex-1"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
      />
      <Button type="submit" size="sm" variant="secondary" disabled={action.isPending}>
        Save
      </Button>
    </form>
  );
}

function Timeline({ t }: { t: TicketDetail }) {
  const auth = useAuth();
  const action = useTicketAction(t.id);
  const [note, setNote] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    action.mutate({ kind: "note", body: note.trim() }, { onSuccess: () => setNote("") });
  };
  return (
    <Card>
      <CardTitle>Timeline</CardTitle>
      <ol className="m-0 list-none p-0">
        {t.timeline.map((e, i) => (
          <li key={i} className="flex gap-2.5 border-b border-divider py-2.5 last:border-b-0">
            <span className="mt-1.5 size-[7px] shrink-0 rounded-full bg-primary" />
            <div className="min-w-0">
              <div className="text-small font-semibold">
                {EVENT_LABEL[e.kind] ?? e.kind}
                <span className="font-normal text-faint">
                  {" "}
                  · {e.actorName} · {formatRelative(e.at)}
                </span>
              </div>
              {e.body ? <div className="mt-0.5 text-small text-ink-soft">{e.body}</div> : null}
            </div>
          </li>
        ))}
      </ol>
      {auth.can("update:maintenance") ? (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2" noValidate>
          <TextAreaField
            label="Add a note"
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
          />
          <FormError message={action.error ? errorMessage(action.error) : null} />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            className="self-end"
            disabled={!note.trim() || action.isPending}
          >
            Add Note
          </Button>
        </form>
      ) : null}
    </Card>
  );
}

function AssignDialog({ t, onClose }: { t: TicketDetail; onClose: () => void }) {
  const staff = useStaff();
  const action = useTicketAction(t.id);
  const toast = useToast();
  const [assigneeId, setAssigneeId] = useState(t.assigneeId ?? "");
  const people = (staff.data ?? []).filter(
    (s) => s.status === "active" && s.roleKey === "maintenance",
  );
  return (
    <Dialog
      open
      title={`Assign ${t.number}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!assigneeId || action.isPending}
            onClick={() =>
              action.mutate(
                { kind: "assign", assigneeId },
                {
                  onSuccess: () => {
                    toast(`${t.number} assigned`);
                    onClose();
                  },
                },
              )
            }
          >
            Assign
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <SelectField
          label="Technician"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
        >
          <option value="">Choose…</option>
          {people.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <FormError message={action.error ? errorMessage(action.error) : null} />
      </div>
    </Dialog>
  );
}

function TextDialog({
  t,
  title,
  label,
  action: actionLabel,
  optional = false,
  onClose,
  toAction,
}: {
  t: TicketDetail;
  title: string;
  label: string;
  action: string;
  optional?: boolean;
  onClose: () => void;
  toAction: (text: string) => Parameters<ReturnType<typeof useTicketAction>["mutate"]>[0];
}) {
  const action = useTicketAction(t.id);
  const toast = useToast();
  const [text, setText] = useState("");
  return (
    <Dialog
      open
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={(!optional && text.trim().length < 3) || action.isPending}
            onClick={() =>
              action.mutate(toAction(text.trim()), {
                onSuccess: () => {
                  toast(`${t.number} updated`);
                  onClose();
                },
              })
            }
          >
            {actionLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextAreaField label={label} value={text} onChange={(e) => setText(e.target.value)} />
        <FormError message={action.error ? errorMessage(action.error) : null} />
      </div>
    </Dialog>
  );
}

function ExtendDialog({ t, onClose }: { t: TicketDetail; onClose: () => void }) {
  const action = useTicketAction(t.id);
  const toast = useToast();
  const base = t.expectedBack ?? hotelToday();
  const [date, setDate] = useState(addIsoDays(base, 1));
  return (
    <Dialog
      open
      title={`Extend Room ${t.roomNumber}'s block`}
      description="The room stays off sale until the new date. Nights already booked can't be blocked."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={action.isPending}
            onClick={() =>
              action.mutate(
                { kind: "extend", expectedBack: date },
                {
                  onSuccess: () => {
                    toast(`Blocked until ${formatIsoDate(date)}`);
                    onClose();
                  },
                },
              )
            }
          >
            Extend
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <InputField
          label="Expected back"
          type="date"
          min={addIsoDays(base, 1)}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <FormError message={action.error ? errorMessage(action.error) : null} />
      </div>
    </Dialog>
  );
}
