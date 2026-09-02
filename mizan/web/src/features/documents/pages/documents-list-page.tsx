import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useUrlParams } from "@/hooks/use-url-params";
import { formatFileSize, formatRelative } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QueryBoundary } from "@/components/feedback/query-boundary";
import { EmptyState } from "@/components/feedback/empty-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { ListToolbar } from "@/components/tables/list-toolbar";
import { useDocumentList, useDocumentMutations } from "../hooks/use-documents";
import { EditDocumentDialog, UploadDocumentDialog } from "../components/document-dialogs";
import { CATEGORIES, type DocRow } from "../api/documents.api";

const STATUS_TONE = { draft: "warning", final: "info", filed: "success", signed: "brand" } as const;

export function DocumentsListPage() {
  const { t } = useTranslation("documents");
  const { can } = usePermissions();
  const params = useUrlParams<"q" | "category" | "status">({});
  const query = useDocumentList({
    q: params.get("q"),
    category: params.get("category"),
    status: params.get("status") as never,
  });
  const { remove } = useDocumentMutations();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<DocRow | null>(null);
  const [deleting, setDeleting] = useState<DocRow | null>(null);
  const canManage = can("create:document");

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage ? (
            <Button icon="upload" onClick={() => setUploading(true)}>
              {t("actions.upload")}
            </Button>
          ) : undefined
        }
      />

      <ListToolbar
        search={{
          value: params.get("q") ?? "",
          onChange: (v) => params.set({ q: v }),
          placeholder: t("search_placeholder"),
        }}
        filters={
          <>
            <Select
              value={params.get("category") ?? "all"}
              onValueChange={(v) => params.set({ category: v === "all" ? undefined : v })}
            >
              <SelectTrigger aria-label={t("fields.category")} className="h-9 w-[9rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_categories")}</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={params.get("status") ?? "all"}
              onValueChange={(v) => params.set({ status: v === "all" ? undefined : v })}
            >
              <SelectTrigger aria-label={t("fields.status")} className="h-9 w-[8rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common:all")}</SelectItem>
                {(["draft", "final", "filed", "signed"] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <QueryBoundary
        query={query}
        loading={<RowsSkeleton rows={8} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <EmptyState
            icon="folder_open"
            title={t("empty.title")}
            description={t("empty.body")}
            action={
              canManage ? (
                <Button icon="upload" onClick={() => setUploading(true)}>
                  {t("actions.upload")}
                </Button>
              ) : undefined
            }
          />
        }
      >
        {(data) => (
          <div className="divide-y divide-divider rounded-lg border border-border bg-surface">
            {data.items.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <Icon
                  name={d.mimeType.includes("word") ? "description" : "picture_as_pdf"}
                  size={20}
                  className="flex-none text-muted"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-foreground">{d.name}</div>
                  <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
                    {d.matterId && (
                      <Link
                        to={`/matters/${d.matterId}?tab=documents`}
                        className="text-link hover:underline"
                      >
                        {d.matterTitle}
                      </Link>
                    )}
                    <span>{d.category}</span>
                    <span>{formatFileSize(d.sizeBytes)}</span>
                    <span>{formatRelative(d.uploadedAt)}</span>
                  </div>
                </div>
                <Badge tone={STATUS_TONE[d.status]} size="sm">
                  {t(`status.${d.status}`)}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={t("common:actions.view")}
                    className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-subtle"
                  >
                    <Icon name="more_horiz" size={17} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem icon="download">{t("common:actions.download")}</DropdownMenuItem>
                    {canManage && (
                      <DropdownMenuItem icon="edit" onSelect={() => setEditing(d)}>
                        {t("common:actions.edit")}
                      </DropdownMenuItem>
                    )}
                    {can("delete:document") && (
                      <DropdownMenuItem icon="delete" destructive onSelect={() => setDeleting(d)}>
                        {t("common:actions.delete")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </QueryBoundary>

      <UploadDocumentDialog open={uploading} onOpenChange={setUploading} />
      <EditDocumentDialog doc={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("delete.title", { name: deleting?.name ?? "" })}
        confirmLabel={t("common:actions.delete")}
        destructive
        onConfirm={async () => {
          if (deleting) await remove.mutateAsync(deleting.id);
          setDeleting(null);
        }}
      />
    </PageContainer>
  );
}
