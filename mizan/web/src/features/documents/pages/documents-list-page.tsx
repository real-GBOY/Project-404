import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useSetPageChrome } from "@/lib/page-chrome";
import { useUrlParams } from "@/hooks/use-url-params";
import { httpClient } from "@/lib/api/http-client";
import { formatDate, formatFileSize } from "@/lib/format";
import { PageContainer } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Pill, type PillTone } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { MatterChip } from "@/components/ui/matter-chip";
import { DocThumb } from "@/components/ui/doc-thumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Cell,
  ColumnHeader,
  ListCard,
  ListRow,
  ListSearch,
  ListToolbar,
  ViewToggle,
} from "@/components/tables/list-card";
import { useDocumentList, useDocumentMutations } from "../hooks/use-documents";
import { EditDocumentDialog, UploadDocumentDialog } from "../components/document-dialogs";
import { CATEGORIES, type DocRow, type DocumentsSummary } from "../api/documents.api";

const STATUS_TONE: Record<string, PillTone> = {
  draft: "amber",
  final: "green",
  filed: "green",
  signed: "purple",
};

export function DocumentsListPage() {
  const { t } = useTranslation("documents");
  const { can } = usePermissions();
  const navigate = useNavigate();
  const params = useUrlParams<"q" | "category" | "status" | "view">({ view: "table" });
  const view = (params.get("view") ?? "table") as "table" | "grid";
  const query = useDocumentList({
    q: params.get("q"),
    category: params.get("category"),
    status: params.get("status") as never,
  });
  const summary = useQuery({
    queryKey: ["documents", "summary"],
    queryFn: ({ signal }) => httpClient<DocumentsSummary>("/documents/summary", { signal }),
  });
  const { remove } = useDocumentMutations();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<DocRow | null>(null);
  const [deleting, setDeleting] = useState<DocRow | null>(null);
  const canManage = can("upload:document");

  useSetPageChrome({ title: t("title"), count: summary.data?.total ?? null });

  const columns = [
    { key: "doc", label: t("columns.document"), flex: 1.6 },
    { key: "matter", label: t("columns.matter"), width: 110 },
    { key: "type", label: t("columns.type"), width: 130 },
    { key: "size", label: t("columns.size"), width: 90 },
    { key: "by", label: t("columns.added_by"), width: 140 },
    { key: "date", label: t("columns.date"), width: 110 },
    { key: "status", label: t("columns.status"), width: 130 },
  ] as const;

  const s = summary.data;
  const uploadBtn = canManage && (
    <Button size="sm" icon="upload" onClick={() => setUploading(true)}>
      {t("actions.upload")}
    </Button>
  );

  return (
    <PageContainer>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label={t("kpi.total")} value={s?.total ?? "—"} />
        <StatCard label={t("kpi.awaiting")} value={s?.awaitingReview ?? "—"} valueTone="warning" />
        <StatCard label={t("kpi.expiring")} value={s?.expiring ?? "—"} valueTone="danger" />
        <StatCard label={t("kpi.added")} value={s?.addedThisMonth ?? "—"} />
      </div>

      <ListCard>
        <ListToolbar>
          <ListSearch
            value={params.get("q") ?? ""}
            placeholder={t("search_placeholder")}
            onChange={(v) => params.set({ q: v })}
          />
          <div className="ms-auto flex flex-wrap items-center gap-2">
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
                {(["draft", "final", "filed", "signed"] as const).map((st) => (
                  <SelectItem key={st} value={st}>
                    {t(`status.${st}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ViewToggle
              value={view}
              onChange={(v) => params.set({ view: v })}
              labels={{ table: t("common:table.view_table"), grid: t("common:table.view_grid") }}
            />
            {uploadBtn}
          </div>
        </ListToolbar>

        <QueryBoundary
          query={query}
          loading={<RowsSkeleton rows={8} />}
          isEmpty={(d) => d.items.length === 0}
          empty={
            <EmptyState
              icon="folder_open"
              title={t("empty.title")}
              description={t("empty.body")}
              action={uploadBtn || undefined}
            />
          }
        >
          {(data) =>
            view === "grid" ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-3.5 px-[18px] py-4">
                {data.items.map((d) => (
                  <DocThumb
                    key={d.id}
                    name={d.name}
                    onClick={() =>
                      d.matterId && navigate(`/matters/${d.matterId}?tab=documents`)
                    }
                    meta={`${d.category} · ${formatFileSize(d.sizeBytes)} · ${formatDate(d.uploadedAt)}`}
                    pill={
                      <span className="flex items-center gap-2">
                        {d.matterReference && <MatterChip>{d.matterReference}</MatterChip>}
                        <Pill tone={STATUS_TONE[d.status]}>{t(`status.${d.status}`)}</Pill>
                      </span>
                    }
                  />
                ))}
              </div>
            ) : (
              <>
                <ColumnHeader columns={[...columns]} />
                {data.items.map((d) => (
                  <ListRow
                    key={d.id}
                    onClick={() =>
                      d.matterId && navigate(`/matters/${d.matterId}?tab=documents`)
                    }
                  >
                    <Cell col={columns[0]} className="flex items-center gap-[11px]">
                      <Icon
                        name={d.mimeType.includes("word") ? "description" : "picture_as_pdf"}
                        size={22}
                        className="flex-none text-muted"
                      />
                      <span className="truncate text-[13px] font-bold text-foreground">{d.name}</span>
                    </Cell>
                    <Cell col={columns[1]}>
                      {d.matterReference ? <MatterChip>{d.matterReference}</MatterChip> : "—"}
                    </Cell>
                    <Cell col={columns[2]} className="truncate">
                      {d.category}
                    </Cell>
                    <Cell col={columns[3]}>{formatFileSize(d.sizeBytes)}</Cell>
                    <Cell col={columns[4]} className="truncate">
                      {d.uploadedBy ?? "—"}
                    </Cell>
                    <Cell col={columns[5]}>
                      {formatDate(d.uploadedAt, { day: "numeric", month: "short", year: "numeric" })}
                    </Cell>
                    <Cell col={columns[6]} className="flex items-center gap-1">
                      <Pill tone={STATUS_TONE[d.status]}>{t(`status.${d.status}`)}</Pill>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={t("common:actions.view")}
                          onClick={(e) => e.stopPropagation()}
                          className="flex size-6 items-center justify-center rounded text-faint hover:bg-surface-subtle"
                        >
                          <Icon name="more_vert" size={16} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem icon="download">
                            {t("common:actions.download")}
                          </DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem icon="edit" onSelect={() => setEditing(d)}>
                              {t("common:actions.edit")}
                            </DropdownMenuItem>
                          )}
                          {can("delete:document") && (
                            <DropdownMenuItem
                              icon="delete"
                              destructive
                              onSelect={() => setDeleting(d)}
                            >
                              {t("common:actions.delete")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Cell>
                  </ListRow>
                ))}
              </>
            )
          }
        </QueryBoundary>
      </ListCard>

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
