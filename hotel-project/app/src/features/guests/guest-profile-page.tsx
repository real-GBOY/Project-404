import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useAddGuestNote, useGuest } from "@/api/guests";
import { useReservations } from "@/api/reservations";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/use-auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { GuestDocuments } from "./guest-documents";
import { FormError } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatEgp, formatIsoDate, formatRelative, formatStay } from "@/lib/format";
import { GuestDialog } from "./guest-dialog";
import { VipBadge } from "./vip-badge";

const DOC_LABEL = { national_id: "National ID", passport: "Passport" } as const;

/** Mask all but the last four characters of an identity document number. */
function masked(value: string): string {
  return value.length <= 4 ? value : `${"•".repeat(value.length - 4)}${value.slice(-4)}`;
}

/**
 * Guest 360 (design: "Guest 360"): identity, contact, preferences and the notes timeline. Stay
 * history and spend join this page once reservations and billing exist.
 */
export function GuestProfilePage() {
  const { guestId = "" } = useParams();
  const auth = useAuth();
  const guest = useGuest(guestId);
  const [editing, setEditing] = useState(false);

  if (guest.isLoading) return <LoadingState />;
  if (guest.error || !guest.data) return <ErrorState error={guest.error} />;
  const g = guest.data;
  const canUpdate = auth.can("update:guest");

  return (
    <>
      <PageHeader
        back={{ to: "/guests", label: "Back to Guests" }}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={g.fullName} size="lg" />
            <span>
              <span className="flex items-center gap-2.5 text-[20px]">
                {g.fullName}
                {g.vip ? <VipBadge /> : null}
              </span>
              <span className="block text-small font-normal text-muted">
                {[g.phone, g.email].filter(Boolean).join(" · ")}
              </span>
            </span>
          </span>
        }
        actions={
          canUpdate ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null
        }
      />

      {auth.can("read:reservation") ? <StayHistory guestId={g.id} /> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle>Profile</CardTitle>
          <dl className="m-0 grid grid-cols-2 gap-3.5 text-small">
            <Detail label="Nationality" value={g.nationality ?? "—"} />
            <Detail
              label="ID document"
              value={
                g.idDocumentType && g.idDocumentNumber
                  ? `${DOC_LABEL[g.idDocumentType]} · ${masked(g.idDocumentNumber)}`
                  : "Not on file"
              }
            />
            <Detail label="Phone" value={g.phone ?? "—"} />
            <Detail label="Email" value={g.email ?? "—"} />
            <Detail label="Guest since" value={formatDate(g.createdAt)} />
          </dl>
        </Card>

        <Card className="self-start">
          <CardTitle>Preferences &amp; Notes</CardTitle>
          <p className="m-0 text-small leading-normal text-ink-soft">
            {g.preferences ?? "No preferences recorded."}
          </p>
          <NotesTimeline guestId={g.id} notes={g.notes} canAdd={canUpdate} />
        </Card>
      </div>
      <GuestDocuments guestId={g.id} />

      {editing ? <GuestDialog guest={g} onClose={() => setEditing(false)} /> : null}
    </>
  );
}

/** Stats + the design's Reservation History, read from the guest's reservations. */
function StayHistory({ guestId }: { guestId: string }) {
  const res = useReservations({ guestId, page: 1, pageSize: 100 });
  if (!res.data) return null;
  const items = res.data.items;
  const stays = items.filter((r) => r.status === "checked_out");
  const lastStay = stays
    .map((r) => r.departure)
    .sort()
    .at(-1);
  const booked = items
    .filter((r) => r.status !== "cancelled" && r.status !== "no_show")
    .reduce((sum, r) => sum + r.total, 0);
  return (
    <>
      <div className="mb-[22px] grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Stat label="Completed stays" value={String(stays.length)} />
        <Stat label="Booked value (before VAT)" value={formatEgp(booked)} />
        <Stat label="Last stay" value={lastStay ? formatIsoDate(lastStay, true) : "—"} />
      </div>
      <Card className="mb-4">
        <CardTitle>Reservation History</CardTitle>
        {items.length === 0 ? (
          <p className="m-0 text-small text-faint">No reservations yet.</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {items.map((r) => (
              <li key={r.id} className="border-b border-divider last:border-b-0">
                <Link
                  to={`/reservations/${r.id}`}
                  className="flex items-center justify-between py-[11px]"
                >
                  <div>
                    <div className="text-small font-semibold">
                      {formatStay(r.arrival, r.departure)} · Room {r.roomNumber ?? "—"}
                    </div>
                    <div className="font-mono text-micro text-faint">#{r.code}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="mb-1.5 text-label text-muted">{label}</div>
      <div className="text-[20px] font-extrabold">{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mb-[3px] text-faint">{label}</dt>
      <dd className="m-0 font-semibold break-words">{value}</dd>
    </div>
  );
}

function NotesTimeline({
  guestId,
  notes,
  canAdd,
}: {
  guestId: string;
  notes: Array<{ id: string; body: string; authorName: string; createdAt: string }>;
  canAdd: boolean;
}) {
  const add = useAddGuestNote(guestId);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    try {
      await add.mutateAsync(body.trim());
      setBody("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="mt-4 border-t border-border-subtle pt-4">
      {notes.length === 0 ? (
        <p className="m-0 text-small text-faint">No notes yet.</p>
      ) : (
        <ol className="m-0 list-none p-0">
          {notes.map((n) => (
            <li key={n.id} className="flex gap-3 pb-3.5">
              <span
                aria-hidden="true"
                className="mt-[5px] size-2 shrink-0 rounded-full bg-primary"
              />
              <div>
                <div className="text-small font-semibold">{n.body}</div>
                <div className="mt-0.5 text-label text-faint">
                  {n.authorName} · {formatRelative(n.createdAt)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {canAdd ? (
        <form onSubmit={submit} className="mt-2 flex flex-col gap-2">
          <label htmlFor="guest-note" className="sr-only">
            Add a note
          </label>
          <textarea
            id="guest-note"
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note for the team…"
            className="rounded-control border border-border bg-canvas px-3.5 py-2.5 text-small outline-none placeholder:text-faint focus:border-primary"
          />
          <FormError message={error} />
          <Button
            type="submit"
            size="sm"
            className="self-end"
            disabled={add.isPending || !body.trim()}
          >
            Add note
          </Button>
        </form>
      ) : null}
    </div>
  );
}
