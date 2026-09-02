import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Combobox } from "@/components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";
import { useMatterFormOptions } from "@/features/matters/hooks/use-matters";
import { useDocumentMutations } from "../hooks/use-documents";
import { CATEGORIES, type DocRow } from "../api/documents.api";

export function UploadDocumentDialog({
  open,
  onOpenChange,
  matterId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matterId?: string;
}) {
  const { t } = useTranslation("documents");
  const options = useMatterFormOptions();
  const { upload } = useDocumentMutations(matterId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("Other");
  const [matter, setMatter] = useState<string | null>(matterId ?? null);

  function reset() {
    setFile(null);
    setCategory("Other");
    setMatter(matterId ?? null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("upload.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-accent bg-surface-subtle px-4 py-8 text-center hover:bg-surface-sand-hover"
          >
            <Icon name="upload_file" size={24} className="text-link" />
            {file ? (
              <span className="text-[12.5px] font-semibold text-foreground">
                {file.name} · {formatFileSize(file.size)}
              </span>
            ) : (
              <span className="text-[12.5px] text-muted">{t("upload.pick")}</span>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          {!matterId && (
            <FormField label={t("fields.matter")}>
              <Combobox
                options={(options.data?.matters ?? []).map((m) => ({ value: m.id, label: m.name }))}
                value={matter}
                onValueChange={setMatter}
                placeholder={t("fields.matter_none")}
              />
            </FormField>
          )}

          <FormField label={t("fields.category")}>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label={t("fields.category")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            icon="upload"
            disabled={!file}
            loading={upload.isPending}
            onClick={async () => {
              if (!file) return;
              const fd = new FormData();
              fd.set("file", file);
              fd.set("name", file.name);
              fd.set("category", category);
              if (matter) fd.set("matterId", matter);
              await upload.mutateAsync(fd);
              reset();
              onOpenChange(false);
            }}
          >
            {t("common:actions.upload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditDocumentDialog({
  doc,
  onOpenChange,
}: {
  doc: DocRow | null;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation("documents");
  const { update } = useDocumentMutations(doc?.matterId ?? undefined);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Other");
  const [status, setStatus] = useState<DocRow["status"]>("draft");

  return (
    <Dialog
      open={!!doc}
      onOpenChange={(o) => {
        if (o && doc) {
          setName(doc.name);
          setCategory(doc.category);
          setStatus(doc.status);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("edit.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-3">
          <FormField label={t("fields.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("fields.category")}>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label={t("fields.category")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t("fields.status")}>
              <Select value={status} onValueChange={(v) => setStatus(v as DocRow["status"])}>
                <SelectTrigger aria-label={t("fields.status")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["draft", "final", "filed", "signed"] as const).map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            loading={update.isPending}
            onClick={async () => {
              if (!doc) return;
              await update.mutateAsync({ id: doc.id, name, category, status });
              onOpenChange(false);
            }}
          >
            {t("common:actions.save_changes")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
