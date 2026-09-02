import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/toast-context";
import { matterKeys } from "@/features/matters/api/matters.api";
import * as api from "../api/tasks.api";
import { taskKeys, type TaskListParams } from "../api/tasks.api";

export const useTaskList = (p: TaskListParams) =>
  useQuery({
    queryKey: taskKeys.list(p),
    queryFn: ({ signal }) => api.listTasks(p, signal),
    placeholderData: (prev) => prev,
  });

export function useTaskMutations(matterId?: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation("tasks");
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: taskKeys.all });
    if (matterId) qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const fail = () => toast.error({ title: t("toasts.failed") });

  return {
    create: useMutation({
      mutationFn: api.createTask,
      onSuccess: () => { invalidate(); toast.success({ title: t("toasts.created") }); },
      onError: fail,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api.updateTask(id, body),
      onSuccess: invalidate,
      onError: fail,
    }),
    complete: useMutation({
      mutationFn: (id: string) => api.completeTask(id),
      onSuccess: invalidate,
      onError: fail,
    }),
    assign: useMutation({
      mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string | null }) =>
        api.assignTask(id, assigneeId),
      onSuccess: invalidate,
      onError: fail,
    }),
  };
}
