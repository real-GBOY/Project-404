import { useRef, useState } from "react";
import {
  openStoredFile,
  useGuestDocuments,
  useRemoveGuestDocument,
  useUploadGuestDocument,
  type GuestDocument,
} from "@/api/workspace";
import { useAuth } from "@/features/auth/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { FormError, SelectField } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";

const KIND_LABEL: Record<GuestDocument["kind"], string> = {
  id_document: "ID document",
  other: "Other",
};

function size(bytes: number | null): string {
  if (bytes === null) return "";
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * A guest's paperwork (a design gap): ID scans and other files, uploaded through Core's files
 * module. Opening a file fetches it with the staff member's own credentials.
 */
export function GuestDocuments({ guestId }: { guestId: string }) {
  const auth = useAuth();
  const docs = useGuestDocuments(guestId, auth.can("read:guest"));
  const upload = useUploadGuestDocument(guestId);
  const remove = useRemoveGuestDocument(guestId);
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<GuestDocument["kind"]>("id_document");
  const canUpload = auth.can("update:guest") && auth.can("upload:file");
  const canOpen = auth.can("read:file");

  const onFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(
      { file, kind, label: null },
      {
        onSuccess: () => toast(`${file.name} attached`),
        onSettled: () => {
          if (input.current) input.current.value = "";
        },
      },
    );
  };

  return (
    <Card className="mt-4">
      <CardTitle>Documents</CardTitle>
      {(docs.data ?? []).length === 0 ? (
        <p className="m-0 mb-3 text-small text-muted">No documents on file.</p>
      ) : (
        <ul className="m-0 mb-3 list-none p-0">
          {docs.data!.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 border-b border-divider py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate text-small font-semibold">
                  {d.label ?? d.fileName ?? "Document"}
                </div>
                <div className="text-label text-faint">
                  {KIND_LABEL[d.kind]} · {size(d.byteSize)} · {d.uploadedByName ?? "—"} ·{" "}
                  {formatDate(d.createdAt)}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {canOpen ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="!px-3 !py-1.5 text-label"
                    onClick={() => openStoredFile(d.fileId).catch((e) => toast(errorMessage(e)))}
                  >
                    Open
                  </Button>
                ) : null}
                {auth.can("update:guest") ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="!px-3 !py-1.5 text-label"
                    disabled={remove.isPending}
                    onClick={() =>
                      remove.mutate(d.id, {
                        onSuccess: () => toast("Document removed"),
                        onError: (e) => toast(errorMessage(e)),
                      })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canUpload ? (
        <div className="flex flex-wrap items-end gap-2.5">
          <SelectField
            label="Type"
            value={kind}
            onChange={(e) => setKind(e.target.value as GuestDocument["kind"])}
          >
            <option value="id_document">ID document</option>
            <option value="other">Other</option>
          </SelectField>
          <input
            ref={input}
            type="file"
            aria-label="Choose a file to attach"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={upload.isPending}
            onClick={() => input.current?.click()}
          >
            {upload.isPending ? "Uploading…" : "Attach file"}
          </Button>
        </div>
      ) : null}
      <FormError message={upload.error ? errorMessage(upload.error) : null} />
    </Card>
  );
}
