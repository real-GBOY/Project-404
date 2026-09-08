import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isApiError } from "@/lib/api/api-error";
import { fetchBlobFromApi } from "@/lib/export";
import { formatFileSize } from "@/lib/format";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Icon } from "@/components/ui/icon";
import { useDocumentDownload } from "../hooks/use-documents";
import { isInlineViewable, viewDocumentPath, type DocRow } from "../api/documents.api";

type State =
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "unsupported" }
  | { kind: "error"; message: string };

/**
 * Opens a document's file in a modal — a PDF (or image / text) renders in an
 * <iframe> fed an object URL, so the user reads it in place instead of
 * downloading. The bytes are fetched with the bearer token; nothing is public.
 */
export function DocumentPreviewDialog({
  doc,
  onOpenChange,
}: {
  doc: DocRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("documents");
  const download = useDocumentDownload();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!doc) return;
    if (!isInlineViewable(doc.mimeType)) {
      setState({ kind: "unsupported" });
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    setState({ kind: "loading" });

    fetchBlobFromApi(viewDocumentPath(doc.id))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ kind: "ready", url: objectUrl });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const noFile = isApiError(err) && err.code === "document.no_file";
        const pending = isApiError(err) && err.code === "document.upload_pending";
        setState({
          kind: "error",
          message: noFile
            ? t("preview.no_file")
            : pending
              ? t("preview.pending")
              : t("preview.failed"),
        });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc, t]);

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate">{doc?.name}</DialogTitle>
          {doc && (
            <span className="text-[12px] text-muted">
              {doc.category} · {formatFileSize(doc.sizeBytes)}
            </span>
          )}
        </DialogHeader>

        <DialogBody className="py-3">
          <div className="flex h-[70vh] items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-subtle">
            {state.kind === "loading" && (
              <span className="flex items-center gap-2 text-[13px] text-muted">
                <Spinner /> {t("preview.loading")}
              </span>
            )}

            {state.kind === "ready" && (
              <iframe
                src={state.url}
                title={doc?.name ?? t("preview.loading")}
                className="h-full w-full border-0 bg-white"
              />
            )}

            {state.kind === "unsupported" && (
              <div className="flex max-w-xs flex-col items-center gap-2 text-center">
                <Icon name="draft" size={28} className="text-faint" />
                <p className="text-[13px] text-muted">{t("preview.unsupported_type")}</p>
              </div>
            )}

            {state.kind === "error" && (
              <div className="flex max-w-xs flex-col items-center gap-2 text-center">
                <Icon name="error" size={28} className="text-danger" />
                <p className="text-[13px] text-muted">{state.message}</p>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common:actions.close")}
          </Button>
          {state.kind === "ready" && (
            <Button
              variant="secondary"
              icon="open_in_new"
              onClick={() => window.open(state.url, "_blank", "noopener")}
            >
              {t("preview.open_new_tab")}
            </Button>
          )}
          {doc && (
            <Button
              icon="download"
              loading={download.isPending}
              onClick={() => download.mutate({ id: doc.id, name: doc.name })}
            >
              {t("common:actions.download")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
