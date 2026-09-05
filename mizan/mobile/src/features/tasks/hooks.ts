import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { taskKeys } from "./api";
import type { TaskListParams } from "./types";
import { matterKeys } from "@/features/matters/api";
import { dashboardKeys } from "@/features/dashboard/api";

export const useTaskList = (p: TaskListParams) =>
  useQuery({
    queryKey: taskKeys.list(p),
    queryFn: ({ signal }) => api.listTasks(p, signal),
    placeholderData: (prev) => prev,
  });

export function useTaskMutations(matterId?: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: taskKeys.all });
    if (matterId) qc.invalidateQueries({ queryKey: matterKeys.detail(matterId) });
    qc.invalidateQueries({ queryKey: dashboardKeys.root });
  };

  return {
    create: useMutation({ mutationFn: api.createTask, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api.updateTask(id, body),
      onSuccess: invalidate,
    }),
    complete: useMutation({ mutationFn: (id: string) => api.completeTask(id), onSuccess: invalidate }),
    assign: useMutation({
      mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string | null }) => api.assignTask(id, assigneeId),
      onSuccess: invalidate,
    }),
  };
}
