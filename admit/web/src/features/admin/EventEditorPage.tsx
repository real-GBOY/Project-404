import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api";
import type { AdminEvent, EventInput, PaymentMethod, TicketType, Venue } from "@/api/types";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Dialog } from "@/components/Dialog";
import { SelectField, TextArea, TextField } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { QueryState } from "@/components/QueryState";
import { useToast } from "@/components/Toast";
import { fromInputValue, slugify, toInputValue } from "@/lib/datetime";
import { errorText } from "@/lib/errors";
import { moneyShort } from "@/lib/format";
import { EVENT } from "@/lib/status";
import { ApiError } from "@/services/http";
import { Forbidden } from "./AdminApp";
import { useAuth } from "./auth";
import { readiness } from "./event-readiness";

interface Draft {
  title: string;
  slug: string;
  category: string;
  description: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
  maxPerBooking: number;
  namedTickets: boolean;
  holdHours: number;
  allowResubmission: boolean;
  supportEmail: string;
  refund: string;
  age: string;
  entry: string;
  program: { time: string; title: string }[];
}

const blank = (venueId = ""): Draft => ({
  title: "",
  slug: "",
  category: "",
  description: "",
  venueId,
  startsAt: "",
  endsAt: "",
  maxPerBooking: 6,
  namedTickets: false,
  holdHours: 24,
  allowResubmission: true,
  supportEmail: "",
  refund: "",
  age: "",
  entry: "",
  program: [],
});

const fromEvent = (e: AdminEvent): Draft => ({
  title: e.title,
  slug: e.slug,
  category: e.category,
  description: e.description,
  venueId: e.venue.id,
  startsAt: toInputValue(e.startsAt),
  endsAt: toInputValue(e.endsAt),
  maxPerBooking: e.maxPerBooking,
  namedTickets: e.namedTickets,
  holdHours: e.holdHours,
  allowResubmission: e.allowResubmission,
  supportEmail: e.supportEmail ?? "",
  refund: e.policies.refund ?? "",
  age: e.policies.age ?? "",
  entry: e.policies.entry ?? "",
  program: e.program.map((p) => ({ time: p.time, title: p.title })),
});

const toInput = (d: Draft): EventInput => ({
  slug: d.slug,
  title: d.title.trim(),
  category: d.category.trim(),
  description: d.description,
  venueId: d.venueId,
  startsAt: fromInputValue(d.startsAt),
  endsAt: fromInputValue(d.endsAt),
  coverUrl: null,
  maxPerBooking: d.maxPerBooking,
  namedTickets: d.namedTickets,
  holdHours: d.holdHours,
  allowResubmission: d.allowResubmission,
  supportEmail: d.supportEmail.trim() || null,
  policies: Object.fromEntries(
    Object.entries({ refund: d.refund.trim(), age: d.age.trim(), entry: d.entry.trim() }).filter(
      ([, v]) => v,
    ),
  ),
  program: d.program
    .filter((p) => p.time.trim() && p.title.trim())
    .map((p) => ({ time: p.time.trim(), title: p.title.trim() })),
});

export default function EventEditorPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const venues = useQuery({ queryKey: ["admin", "venues"], queryFn: () => adminApi.venues.list() });
  const event = useQuery({
    queryKey: ["admin", "event", id],
    queryFn: () => adminApi.events.get(id!),
    enabled: !!id,
  });
  if (!can(id ? "update:event" : "create:event"))
    return <Forbidden needs={id ? "update:event" : "create:event"} />;
  if (id)
    return (
      <QueryState query={event}>
        {(e) => <Editor key={e.id + e.title} event={e} venues={venues.data ?? []} />}
      </QueryState>
    );
  return <QueryState query={venues}>{(v) => <Editor venues={v} />}</QueryState>;
}

function Editor({ event, venues }: { event?: AdminEvent; venues: Venue[] }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { can, me } = useAuth();
  const [d, setD] = useState<Draft>(() => (event ? fromEvent(event) : blank(venues[0]?.id)));
  const [dirty, setDirty] = useState(!event);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [venueOpen, setVenueOpen] = useState<false | "new" | "edit">(false);
  const [confirm, setConfirm] = useState<"unpublish" | "cancel" | "archive" | "delete" | null>(
    null,
  );
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };
  const venue = venues.find((v) => v.id === d.venueId);
  const ready = useMemo(
    () =>
      readiness(
        { ...d, startsAt: fromInputValue(d.startsAt), endsAt: fromInputValue(d.endsAt) },
        event,
        venue,
      ),
    [d, event, venue],
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const fail = (err: unknown) => {
    if (err instanceof ApiError && err.fields.length) {
      setFieldErrors(Object.fromEntries(err.fields.map((f) => [f.path, f.message])));
      setError("Some fields need attention.");
    } else setError(errorText(err));
  };

  const save = useMutation({
    mutationFn: async () => {
      setError(null);
      setFieldErrors({});
      const body = toInput(d);
      return event ? adminApi.events.update(event.id, body) : adminApi.events.create(body);
    },
    onSuccess: async (saved) => {
      setDirty(false);
      await invalidate();
      toast.show("Draft saved");
      if (!event) nav(`/admin/events/${saved.id}`, { replace: true });
    },
    onError: fail,
  });
  const act = useMutation({
    mutationFn: async (a: "publish" | "unpublish" | "cancel" | "archive") => {
      setError(null);
      if (dirty) await adminApi.events.update(event!.id, toInput(d));
      return adminApi.events[a](event!.id);
    },
    onSuccess: async () => {
      setDirty(false);
      await invalidate();
    },
    onError: fail,
  });
  const removeEvent = useMutation({
    mutationFn: () => adminApi.events.remove(event!.id),
    onSuccess: async () => {
      setDirty(false);
      await invalidate();
      toast.show("Draft deleted");
      nav("/admin/events", { replace: true });
    },
    onError: (err) => {
      setConfirm(null);
      fail(err);
    },
  });
  const runConfirmed = () => {
    const what = confirm;
    if (what === "delete") return removeEvent.mutate();
    if (what) act.mutate(what);
    setConfirm(null);
  };
  const locked = event?.status === "archived" || event?.status === "cancelled";

  return (
    <>
      <div className="sticky top-[68px] z-[4] flex flex-wrap items-center gap-2.5 border border-ink bg-surface px-3.5 py-2.5">
        {event ? (
          <Badge status={EVENT[event.status]} />
        ) : (
          <Badge status={EVENT.draft}>New event</Badge>
        )}
        <span className="min-w-0 flex-1 truncate font-semibold">{d.title || "Untitled event"}</span>
        {dirty ? (
          <span className="text-xs font-semibold text-used-fg">! Unsaved changes</span>
        ) : null}
        {event?.status === "published" && me ? (
          <a
            className="inline-flex h-[38px] items-center rounded-sm border border-rule-strong bg-surface px-3.5 text-[13px] font-semibold no-underline"
            href={`/e/${me.organizer.slug}/events/${event.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            View live page ↗
          </a>
        ) : null}
        {!locked ? (
          <Button
            variant="secondary"
            size="md"
            loading={save.isPending}
            disabled={!dirty || !d.title.trim() || !d.slug || !d.venueId}
            onClick={() => save.mutate()}
          >
            {event ? "Save changes" : "Create draft"}
          </Button>
        ) : null}
        {event && !locked && can("publish:event") ? (
          event.status === "published" ? (
            <Button
              size="md"
              variant="ink"
              loading={act.isPending}
              onClick={() => setConfirm("unpublish")}
            >
              Unpublish
            </Button>
          ) : (
            <Button
              size="md"
              loading={act.isPending}
              disabled={!ready.ok}
              onClick={() => act.mutate("publish")}
            >
              Publish…
            </Button>
          )
        ) : null}
      </div>
      {error ? <Notice tone="bad">{error}</Notice> : null}

      <div className="grid items-start gap-7 lg:grid-cols-[200px_minmax(0,1fr)_300px]">
        <nav
          aria-label="Sections"
          className="sticky top-36 hidden flex-col gap-0.5 text-sm lg:flex"
        >
          {ready.sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`flex justify-between rounded-xs px-2.5 py-1.5 no-underline ${s.ok ? "" : "bg-bad-bg"}`}
            >
              <span>{s.label}</span>
              <span className={`text-xs font-bold ${s.ok ? "text-ok-fg" : "text-bad-fg"}`}>
                {s.ok ? "✓" : "✕"}
              </span>
            </a>
          ))}
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          <Section id="basic" title="Basic information">
            <TextField
              label="Event name"
              value={d.title}
              onChange={(e) => {
                set("title", e.target.value);
                if (!event) set("slug", slugify(e.target.value));
              }}
              disabled={locked}
              error={fieldErrors.title}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Category"
                value={d.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Concert, Comedy, Workshop…"
                disabled={locked}
              />
              <TextField
                label="Public address"
                mono
                value={d.slug}
                onChange={(e) => set("slug", slugify(e.target.value))}
                disabled={locked || (!!event && event.status !== "draft")}
                error={fieldErrors.slug}
                hint={
                  event && event.status !== "draft"
                    ? "Locked once published: customers may hold links to it."
                    : "Letters, numbers and dashes."
                }
              />
            </div>
            <TextArea
              label="Description"
              value={d.description}
              onChange={(e) => set("description", e.target.value)}
              disabled={locked}
              hint={`${d.description.length} / 5,000. A blank line starts a new paragraph.`}
            />
          </Section>

          <Section
            id="when"
            title="Date, time & venue"
            bad={ready.sections.find((s) => s.id === "when")?.ok === false}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Starts"
                type="datetime-local"
                value={d.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
                disabled={locked}
                error={fieldErrors.startsAt}
              />
              <TextField
                label="Ends"
                type="datetime-local"
                value={d.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
                disabled={locked}
                error={
                  d.startsAt && d.endsAt && fromInputValue(d.endsAt) <= fromInputValue(d.startsAt)
                    ? "End must be after start."
                    : fieldErrors.endsAt
                }
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SelectField
                  label="Venue"
                  value={d.venueId}
                  onChange={(e) => set("venueId", e.target.value)}
                  disabled={locked}
                >
                  <option value="">Choose a venue…</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.area ? ` · ${v.area}` : ""} · capacity {v.capacity}
                    </option>
                  ))}
                </SelectField>
              </div>
              {venue && can("update:event") ? (
                <Button variant="secondary" onClick={() => setVenueOpen("edit")} disabled={locked}>
                  Edit venue
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setVenueOpen("new")} disabled={locked}>
                New venue
              </Button>
            </div>
          </Section>

          {event ? (
            <>
              <TicketTypes event={event} locked={locked} />
              <Section id="booking" title="Booking & payment settings">
                <div className="grid gap-3 sm:grid-cols-3">
                  <SelectField
                    label="Payment hold"
                    value={d.holdHours}
                    onChange={(e) => set("holdHours", Number(e.target.value))}
                    disabled={locked}
                    hint="Unpaid bookings expire and release tickets."
                  >
                    {[6, 12, 24, 48, 72].map((h) => (
                      <option key={h} value={h}>
                        {h} hours
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="Max tickets per booking"
                    type="number"
                    min={1}
                    max={6}
                    value={d.maxPerBooking}
                    onChange={(e) =>
                      set("maxPerBooking", Math.min(6, Math.max(1, Number(e.target.value) || 1)))
                    }
                    disabled={locked}
                  />
                  <TextField
                    label="Support email"
                    type="email"
                    value={d.supportEmail}
                    onChange={(e) => set("supportEmail", e.target.value)}
                    disabled={locked}
                    hint="Shown on tickets and emails."
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-ink"
                    checked={d.namedTickets}
                    onChange={(e) => set("namedTickets", e.target.checked)}
                    disabled={locked}
                  />
                  Name every ticket (the customer enters a holder per ticket)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-ink"
                    checked={d.allowResubmission}
                    onChange={(e) => set("allowResubmission", e.target.checked)}
                    disabled={locked}
                  />
                  Let customers resubmit proof after a rejection, while the hold lasts
                </label>
              </Section>
              <PaymentMethods event={event} locked={locked} />
              {can("manage:event_staff") ? <EventStaff event={event} /> : null}
            </>
          ) : (
            <Notice tone="info">
              Create the draft first. Then you can add ticket types and payment methods.
            </Notice>
          )}

          <Section id="policies" title="Policies & program">
            <TextField
              label="Refund policy"
              value={d.refund}
              onChange={(e) => set("refund", e.target.value)}
              disabled={locked}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Age / entry requirements"
                value={d.age}
                onChange={(e) => set("age", e.target.value)}
                disabled={locked}
              />
              <TextField
                label="At the door"
                value={d.entry}
                onChange={(e) => set("entry", e.target.value)}
                disabled={locked}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Program</span>
              {d.program.map((p, i) => (
                <div key={i} className="grid grid-cols-[90px_1fr_auto] items-center gap-2">
                  <input
                    aria-label={`Program time ${i + 1}`}
                    value={p.time}
                    onChange={(e) =>
                      set(
                        "program",
                        d.program.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)),
                      )
                    }
                    className="h-10 rounded-sm border border-rule-strong px-2.5 font-mono text-sm"
                    placeholder="20:00"
                    disabled={locked}
                  />
                  <input
                    aria-label={`Program item ${i + 1}`}
                    value={p.title}
                    onChange={(e) =>
                      set(
                        "program",
                        d.program.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                      )
                    }
                    className="h-10 rounded-sm border border-rule-strong px-2.5 text-sm"
                    placeholder="Set one"
                    disabled={locked}
                  />
                  <button
                    aria-label={`Remove program item ${i + 1}`}
                    className="size-8 rounded-sm border border-rule-strong"
                    onClick={() =>
                      set(
                        "program",
                        d.program.filter((_, j) => j !== i),
                      )
                    }
                    disabled={locked}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => set("program", [...d.program, { time: "", title: "" }])}
                disabled={locked}
              >
                + Add program item
              </Button>
            </div>
          </Section>

          {event && can("publish:event") && !locked ? (
            <Section id="danger" title="Close this event">
              <p className="text-sm text-ink-2">
                Cancelling stops sales and the door scanner for this event, and customers who have
                not paid yet can no longer send proof. Existing bookings stay on record; refunds
                happen outside Admit. Archiving hides a finished event from the lists.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="md"
                  loading={act.isPending}
                  onClick={() => setConfirm("cancel")}
                >
                  Cancel event
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  loading={act.isPending}
                  onClick={() => setConfirm("archive")}
                >
                  Archive
                </Button>
              </div>
            </Section>
          ) : null}

          {event && event.status === "draft" && can("update:event") ? (
            <Section id="delete" title="Delete this draft">
              <p className="text-sm text-ink-2">
                Removes the draft with its ticket types and payment methods. Only possible while
                nobody has booked it; once it has bookings, cancel or archive it instead.
              </p>
              <div>
                <Button variant="danger" size="md" onClick={() => setConfirm("delete")}>
                  Delete draft
                </Button>
              </div>
            </Section>
          ) : null}
        </div>

        <aside className="flex flex-col gap-3.5 lg:sticky lg:top-36">
          <div className="border border-ink bg-surface">
            <div className="stripes aspect-[4/3]" />
            <div className="flex flex-col gap-1.5 p-3.5">
              <span className="font-mono text-xs text-brand-deep">
                {d.startsAt
                  ? new Date(fromInputValue(d.startsAt))
                      .toLocaleString("en-GB", {
                        timeZone: "Africa/Cairo",
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })
                      .toUpperCase()
                  : "DATE NOT SET"}
              </span>
              <span className="display-l text-[22px]">{d.title || "Untitled event"}</span>
              <span className="text-[13px] text-ink-2">{venue?.name ?? "No venue yet"}</span>
              <span className="border-t border-dashed border-rule-strong pt-2 text-[13px]">
                {event && event.ticketTypes.length ? (
                  <>
                    From{" "}
                    <strong className="font-mono">
                      {moneyShort(
                        Math.min(...event.ticketTypes.map((t) => t.priceMinor)),
                        event.currency,
                      )}
                    </strong>{" "}
                    · {event.ticketTypes.length} types · {event.capacityAllocated} tickets
                  </>
                ) : (
                  "No tickets yet"
                )}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 text-[13px]" aria-label="Ready to publish?">
            <span className="font-semibold">Ready to publish?</span>
            {ready.checks.map((c) => (
              <span key={c.label} className={c.ok ? "text-ok-fg" : "font-semibold text-bad-fg"}>
                {c.ok ? "✓" : "✕"} {c.label}
              </span>
            ))}
          </div>
        </aside>
      </div>
      <VenueDialog
        key={venueOpen === "edit" ? `edit-${venue?.id}` : "new"}
        open={venueOpen !== false}
        venue={venueOpen === "edit" ? venue : undefined}
        onClose={() => setVenueOpen(false)}
        onSaved={(v) => {
          void qc.invalidateQueries({ queryKey: ["admin"] }).then(() => set("venueId", v.id));
          setVenueOpen(false);
        }}
        onDeleted={() => {
          void qc.invalidateQueries({ queryKey: ["admin"] }).then(() => set("venueId", ""));
          setVenueOpen(false);
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm === "unpublish"
            ? "Unpublish this event?"
            : confirm === "cancel"
              ? "Cancel this event?"
              : confirm === "archive"
                ? "Archive this event?"
                : "Delete this draft?"
        }
        confirmLabel={
          confirm === "unpublish"
            ? "Unpublish"
            : confirm === "cancel"
              ? "Cancel event"
              : confirm === "archive"
                ? "Archive"
                : "Delete draft"
        }
        tone={confirm === "unpublish" ? "ink" : "danger"}
        busy={act.isPending || removeEvent.isPending}
        onConfirm={runConfirmed}
      >
        {confirm === "unpublish" ? (
          <p>
            The event leaves the public site and nobody can start a new booking. Bookings already
            made keep working. You can publish it again later.
          </p>
        ) : confirm === "cancel" ? (
          <p>
            Sales and the door scanner stop for this event, and customers who have not paid yet can
            no longer send proof. Existing bookings stay on record;{" "}
            <strong>refunds happen outside Admit</strong>. This cannot be undone.
          </p>
        ) : confirm === "archive" ? (
          <p>
            The event is hidden from the lists and can no longer be edited. It stays in reports.
          </p>
        ) : (
          <p>
            The draft, its ticket types and its payment methods are removed for good. Its address
            becomes free again.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

function Section({
  id,
  title,
  children,
  bad,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  bad?: boolean;
}) {
  return (
    <section
      id={id}
      className={`flex scroll-mt-40 flex-col gap-3.5 border bg-surface p-5 ${bad ? "border-bad-line" : "border-rule"}`}
    >
      <h2 className="m-0 text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function VenueDialog({
  open,
  venue,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  /** Present when editing an existing venue; absent for "New venue". */
  venue?: Venue;
  onClose: () => void;
  onSaved: (v: Venue) => void;
  onDeleted: () => void;
}) {
  const [v, setV] = useState({
    name: venue?.name ?? "",
    area: venue?.area ?? "",
    address: venue?.address ?? "",
    capacity: venue ? String(venue.capacity) : "",
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const body = () => ({
    name: v.name.trim(),
    area: v.area.trim(),
    address: v.address.trim(),
    mapUrl: venue?.mapUrl ?? null,
    capacity: Number(v.capacity),
  });
  const save = useMutation({
    mutationFn: () =>
      venue ? adminApi.venues.update(venue.id, body()) : adminApi.venues.create(body()),
    onSuccess: onSaved,
  });
  const remove = useMutation({
    mutationFn: () => adminApi.venues.remove(venue!.id),
    onSuccess: onDeleted,
  });
  const ok = v.name.trim().length >= 2 && Number(v.capacity) >= 1;
  return (
    <Dialog open={open} onClose={onClose} title={venue ? "Edit venue" : "New venue"}>
      <div className="flex flex-col gap-3 px-[22px] pt-3">
        <TextField
          label="Name"
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Area"
            value={v.area}
            onChange={(e) => setV({ ...v, area: e.target.value })}
          />
          <TextField
            label="Capacity"
            type="number"
            min={1}
            value={v.capacity}
            onChange={(e) => setV({ ...v, capacity: e.target.value })}
          />
        </div>
        <TextField
          label="Address"
          value={v.address}
          onChange={(e) => setV({ ...v, address: e.target.value })}
        />
        {save.isError || remove.isError ? (
          <p role="alert" className="text-sm text-bad-solid">
            {errorText(save.error ?? remove.error)}
          </p>
        ) : null}
        {venue && confirmDelete ? (
          <div className="flex flex-col gap-2 border border-bad-line bg-bad-bg p-3 text-sm">
            <span>
              Delete <strong>{venue.name}</strong>? Only possible while no event uses it.
            </span>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                loading={remove.isPending}
                onClick={() => remove.mutate()}
              >
                Yes, delete venue
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 p-[22px]">
        <div>
          {venue && !confirmDelete ? (
            <Button variant="danger" size="md" onClick={() => setConfirmDelete(true)}>
              Delete venue
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="ink"
            size="md"
            disabled={!ok}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {venue ? "Save venue" : "Add venue"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function TicketTypes({ event, locked }: { event: AdminEvent; locked: boolean }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const allowed = can("manage:ticket_type") && !locked;
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const [add, setAdd] = useState({ name: "", price: "", qty: "" });
  const create = useMutation({
    mutationFn: () =>
      adminApi.events.addType(event.id, {
        name: add.name.trim(),
        description: "",
        priceMinor: Math.round(Number(add.price) * 100),
        quantity: Number(add.qty),
        maxPerBooking: event.maxPerBooking,
        onSale: true,
        sortOrder: event.ticketTypes.length,
      }),
    onSuccess: async () => {
      setAdd({ name: "", price: "", qty: "" });
      await refresh();
    },
  });
  return (
    <Section id="tickets" title="Ticket types, pricing & capacity">
      <div className="flex justify-between text-xs text-ink-2">
        <span>
          Venue capacity <strong className="font-mono">{event.venue.capacity}</strong> · allocated{" "}
          <strong
            className={`font-mono ${event.capacityAllocated > event.venue.capacity ? "text-bad-fg" : ""}`}
          >
            {event.capacityAllocated}
          </strong>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-ink text-left text-[11px] uppercase tracking-[0.06em] text-ink-2">
              <th className="py-2 pr-1.5">Name</th>
              <th className="px-1.5">Price EGP</th>
              <th className="px-1.5">Quantity</th>
              <th className="px-1.5">Taken</th>
              <th className="px-1.5">On sale</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {event.ticketTypes.map((t) => (
              <TypeRow
                key={t.id + t.name + t.priceMinor + t.quantity + t.onSale}
                t={t}
                disabled={!allowed}
                onChanged={refresh}
              />
            ))}
          </tbody>
        </table>
      </div>
      {allowed ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="min-w-[180px] flex-1">
            <TextField
              label="New ticket type"
              value={add.name}
              onChange={(e) => setAdd({ ...add, name: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="w-28">
            <TextField
              label="Price EGP"
              inputMode="decimal"
              value={add.price}
              onChange={(e) => setAdd({ ...add, price: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="w-28">
            <TextField
              label="Quantity"
              inputMode="numeric"
              value={add.qty}
              onChange={(e) => setAdd({ ...add, qty: e.target.value })}
              className="h-10"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            size="md"
            loading={create.isPending}
            disabled={add.name.trim().length < 2 || add.price === "" || !Number(add.qty)}
          >
            + Add ticket type
          </Button>
          {create.isError ? (
            <p role="alert" className="basis-full text-sm text-bad-solid">
              {errorText(create.error)}
            </p>
          ) : null}
        </form>
      ) : null}
    </Section>
  );
}

function TypeRow({
  t,
  disabled,
  onChanged,
}: {
  t: TicketType;
  disabled: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState(t.name);
  const [price, setPrice] = useState(String(t.priceMinor / 100));
  const [qty, setQty] = useState(String(t.quantity));
  const save = useMutation({
    mutationFn: (patch: Parameters<typeof adminApi.ticketTypes.update>[1]) =>
      adminApi.ticketTypes.update(t.id, patch),
    onSuccess: onChanged,
  });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const remove = useMutation({
    mutationFn: () => adminApi.ticketTypes.remove(t.id),
    onSuccess: onChanged,
    onSettled: () => setConfirmRemove(false),
  });
  const dirty =
    name !== t.name ||
    Math.round(Number(price) * 100) !== t.priceMinor ||
    Number(qty) !== t.quantity;
  const cell = "h-9 rounded-sm border border-rule-strong px-2.5 text-sm";
  return (
    <>
      <tr className="border-b border-rule-soft">
        <td className="py-2 pr-1.5">
          <input
            aria-label="Ticket type name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled}
            className={`${cell} w-full`}
          />
        </td>
        <td className="px-1.5">
          <input
            aria-label="Price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={disabled}
            className={`${cell} w-24 font-mono`}
          />
        </td>
        <td className="px-1.5">
          <input
            aria-label="Quantity"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={disabled}
            className={`${cell} w-20 font-mono`}
          />
        </td>
        <td className="px-1.5 font-mono text-xs text-ink-2">{t.held}</td>
        <td className="px-1.5">
          <input
            type="checkbox"
            aria-label="On sale"
            className="accent-ink"
            checked={t.onSale}
            disabled={disabled || save.isPending}
            onChange={(e) => save.mutate({ onSale: e.target.checked })}
          />
        </td>
        <td className="whitespace-nowrap py-2 text-right">
          {dirty && !disabled ? (
            <Button
              size="sm"
              variant="ink"
              loading={save.isPending}
              onClick={() =>
                save.mutate({
                  name: name.trim(),
                  priceMinor: Math.round(Number(price) * 100),
                  quantity: Number(qty),
                })
              }
            >
              Save
            </Button>
          ) : null}{" "}
          {!disabled ? (
            <button
              aria-label={`Remove ${t.name}`}
              className="size-8 rounded-sm border border-rule-strong bg-surface text-ink-2"
              onClick={() => setConfirmRemove(true)}
            >
              ✕
            </button>
          ) : null}
        </td>
      </tr>
      {save.isError || remove.isError ? (
        <tr>
          <td colSpan={6} className="pb-2 text-xs text-bad-solid">
            <div role="alert">{errorText(save.error ?? remove.error)}</div>
          </td>
        </tr>
      ) : null}
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`Remove ${t.name}?`}
        confirmLabel="Remove ticket type"
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
      >
        <p>A ticket type that already has bookings cannot be removed: take it off sale instead.</p>
      </ConfirmDialog>
    </>
  );
}

function PaymentMethods({ event, locked }: { event: AdminEvent; locked: boolean }) {
  const qc = useQueryClient();
  const { can } = useAuth();
  const allowed = can("manage:payment_method") && !locked;
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin"] });
  const [draft, setDraft] = useState<{
    /** Set when editing an existing method. */
    id?: string;
    type: PaymentMethod["type"];
    label: string;
    recipientName: string;
    identifier: string;
    instructions: string;
  } | null>(null);
  const [removing, setRemoving] = useState<PaymentMethod | null>(null);
  const create = useMutation({
    mutationFn: () => {
      const fields = {
        type: draft!.type,
        label: draft!.label.trim(),
        recipientName: draft!.recipientName.trim(),
        identifier: draft!.identifier.trim(),
        instructions: draft!.instructions
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      return draft!.id
        ? adminApi.paymentMethods.update(draft!.id, fields)
        : adminApi.events.addMethod(event.id, {
            ...fields,
            enabled: true,
            sortOrder: event.paymentMethods.length,
          });
    },
    onSuccess: async () => {
      setDraft(null);
      await refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: (m: PaymentMethod) => adminApi.paymentMethods.update(m.id, { enabled: !m.enabled }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (m: PaymentMethod) => adminApi.paymentMethods.remove(m.id),
    onSuccess: refresh,
    onSettled: () => setRemoving(null),
  });
  return (
    <Section id="methods" title="Payment methods customers see">
      <p className="text-sm text-ink-2">
        Where customers send money. Sensitive: changes are audited and apply to new bookings.
      </p>
      {event.paymentMethods.map((m) => (
        <div
          key={m.id}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-rule-soft pt-3"
        >
          <span className="font-semibold">{m.label}</span>
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              className="accent-ink"
              checked={m.enabled}
              disabled={!allowed}
              onChange={() => toggle.mutate(m)}
            />
            Enabled
          </label>
          <span className="text-[13px] text-ink-2">
            <span className="font-mono">{m.identifier}</span> · {m.recipientName}
          </span>
          {allowed ? (
            <span className="flex justify-self-end gap-3">
              <button
                className="text-xs font-semibold underline"
                onClick={() =>
                  setDraft({
                    id: m.id,
                    type: m.type,
                    label: m.label,
                    recipientName: m.recipientName,
                    identifier: m.identifier,
                    instructions: m.instructions.join("\n"),
                  })
                }
              >
                Edit
              </button>
              <button
                className="text-xs font-semibold text-bad-solid underline"
                onClick={() => setRemoving(m)}
              >
                Remove
              </button>
            </span>
          ) : null}
        </div>
      ))}
      {remove.isError || toggle.isError ? (
        <p role="alert" className="text-sm text-bad-solid">
          {errorText(remove.error ?? toggle.error)}
        </p>
      ) : null}
      {allowed && !draft ? (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() =>
            setDraft({
              type: "instapay",
              label: "",
              recipientName: "",
              identifier: "",
              instructions: "",
            })
          }
        >
          + Add method
        </Button>
      ) : null}
      {draft ? (
        <form
          className="flex flex-col gap-3 border border-rule-strong bg-paper p-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Type"
              value={draft.type}
              onChange={(e) =>
                setDraft({ ...draft, type: e.target.value as PaymentMethod["type"] })
              }
            >
              <option value="instapay">InstaPay</option>
              <option value="wallet">Mobile wallet</option>
              <option value="bank">Bank transfer</option>
              <option value="cash_deposit">Cash deposit</option>
              <option value="other">Other</option>
            </SelectField>
            <TextField
              label="Name shown to customers"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
            <TextField
              label="Recipient name"
              value={draft.recipientName}
              onChange={(e) => setDraft({ ...draft, recipientName: e.target.value })}
            />
            <TextField
              label="Address, number or IBAN"
              mono
              value={draft.identifier}
              onChange={(e) => setDraft({ ...draft, identifier: e.target.value })}
            />
          </div>
          <TextArea
            label="Steps (one per line)"
            value={draft.instructions}
            onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
          />
          {create.isError ? (
            <p role="alert" className="text-sm text-bad-solid">
              {errorText(create.error)}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="ink"
              size="md"
              loading={create.isPending}
              disabled={
                draft.label.trim().length < 2 ||
                draft.recipientName.trim().length < 2 ||
                draft.identifier.trim().length < 2
              }
            >
              {draft.id ? "Save method" : "Add method"}
            </Button>
            <Button variant="secondary" size="md" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.label ?? "this method"}?`}
        confirmLabel="Remove method"
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing)}
      >
        <p>
          Customers will no longer see it. A method that customers have already paid with cannot be
          removed: disable it instead. A published event always keeps at least one enabled method.
        </p>
      </ConfirmDialog>
    </Section>
  );
}

/** Who works this event, and at which gate. People without "see every event" reach only the events they are assigned to here. */
function EventStaff({ event }: { event: AdminEvent }) {
  const qc = useQueryClient();
  const staff = useQuery({
    queryKey: ["admin", "event-staff", event.id],
    queryFn: () => adminApi.events.staff(event.id),
  });
  const team = useQuery({ queryKey: ["admin", "team"], queryFn: () => adminApi.team.get() });
  const [userId, setUserId] = useState("");
  const [gate, setGate] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "event-staff", event.id] });
  const assign = useMutation({
    mutationFn: () => adminApi.events.assign(event.id, userId, gate.trim()),
    onSuccess: async () => {
      setUserId("");
      setGate("");
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.events.unassign(event.id, id),
    onSuccess: refresh,
  });
  const free = (team.data?.members ?? []).filter(
    (m) => !staff.data?.some((s) => s.userId === m.userId),
  );
  return (
    <Section id="staff" title="Event staff & gates">
      <p className="text-sm text-ink-2">
        Door staff scan and reviewers decide payments only for events listed here. Owners and
        managers see every event.
      </p>
      <QueryState
        query={staff}
        empty={(d) =>
          d.length === 0 ? <p className="text-sm text-ink-2">Nobody is assigned yet.</p> : false
        }
      >
        {(d) => (
          <ul className="m-0 list-none p-0">
            {d.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-3 border-t border-rule-soft py-2.5 text-sm"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-xs text-muted">{m.email}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs text-ink-2">{m.gate || "no gate"}</span>
                  <button
                    aria-label={`Unassign ${m.name}`}
                    className="text-xs font-semibold text-bad-solid underline"
                    onClick={() => remove.mutate(m.userId)}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </QueryState>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          assign.mutate();
        }}
      >
        <div className="min-w-[200px] flex-1">
          <SelectField
            label="Add a person"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="h-10"
          >
            <option value="">Choose…</option>
            {free.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-36">
          <TextField
            label="Gate"
            value={gate}
            onChange={(e) => setGate(e.target.value)}
            placeholder="Gate A"
            className="h-10"
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          size="md"
          loading={assign.isPending}
          disabled={!userId}
        >
          Assign
        </Button>
        {assign.isError || remove.isError ? (
          <p role="alert" className="basis-full text-sm text-bad-solid">
            {errorText(assign.error ?? remove.error)}
          </p>
        ) : null}
      </form>
    </Section>
  );
}
