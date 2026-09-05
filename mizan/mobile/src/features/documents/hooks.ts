import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { documentKeys } from "./api";
import type { DocListParams, DocRow } from "./types";
import { listOfflineDocuments, pinDocumentOffline, unpinDocumentOffline, getOfflineTotalBytes } from "./offline";

export const useDocumentList = (p: DocListParams) =>
  useQuery({
    queryKey: documentKeys.list(p),
    queryFn: ({ signal }) => api.listDocuments(p, signal),
    placeholderData: (prev) => prev,
  });

const offlineKeys = {
  all: ["documents", "offline"] as const,
  bytes: ["documents", "offline", "bytes"] as const,
};

export const useOfflineDocuments = () =>
  useQuery({ queryKey: offlineKeys.all, queryFn: listOfflineDocuments });

export const useOfflineStorageUsed = () =>
  useQuery({ queryKey: offlineKeys.bytes, queryFn: getOfflineTotalBytes });

export function useOfflinePinning() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: offlineKeys.all });
    qc.invalidateQueries({ queryKey: offlineKeys.bytes });
  };
  return {
    pin: useMutation({ mutationFn: (doc: DocRow) => pinDocumentOffline(doc), onSuccess: invalidate }),
    unpin: useMutation({ mutationFn: (id: string) => unpinDocumentOffline(id), onSuccess: invalidate }),
  };
}

export function useDocumentMutations() {
  const qc = useQueryClient();
  return {
    upload: useMutation({
      mutationFn: (form: FormData) => api.uploadDocument(form),
      onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
    }),
  };
}
