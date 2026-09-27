import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useAddGuestNote, useGuest } from "@/api/guests";
import { useAuth } from "@/features/auth/use-auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatRelative } from "@/lib/format";
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

      {editing ? <GuestDialog guest={g} onClose={() => setEditing(false)} /> : null}
    </>
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
