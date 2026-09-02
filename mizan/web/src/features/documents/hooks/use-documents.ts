import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/toast-context";
import { matterKeys } from "@/features/matters/api/matters.api";
import * as api from "../api/documents.api";
import { documentKeys, type DocListParams, type DocRow } from "../api/documents.api";

export const useDocumentList = (p: DocListParams) =>
  useQuery({
    queryKey: documentKeys.list(p),
    queryFn: ({ signal }) => api.listDocuments(p, signal),
    placeholderData: (prev) => prev,
  });

export function useDocumentMutations(matterId?: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation("documents");
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: documentKeys.all });
    if (matterId) qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
  };
  const fail = () => toast.error({ title: t("toasts.failed") });

  return {
    upload: useMutation({
      mutationFn: (form: FormData) => api.uploadDocument(form),
      onSuccess: () => {
        invalidate();
        toast.success({ title: t("toasts.uploaded") });
      },
      onError: fail,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Partial<DocRow>) => api.updateDocument(id, body),
      onSuccess: () => {
        invalidate();
        toast.success({ title: t("toasts.updated") });
      },
      onError: fail,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api.deleteDocument(id),
      onSuccess: () => {
        invalidate();
        toast.success({ title: t("toasts.deleted") });
      },
      onError: fail,
    }),
  };
}
