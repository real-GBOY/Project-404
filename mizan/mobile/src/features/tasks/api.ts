import { httpClient } from "@/lib/api/http-client";
import type { TaskRow, TaskListParams, TaskPriority } from "./types";

export const taskKeys = {
  all: ["tasks"] as const,
  list: (p: TaskListParams) => [...taskKeys.all, "list", p] as const,
};

export const listTasks = (p: TaskListParams, signal?: AbortSignal) =>
  httpClient<{ items: TaskRow[]; total: number }>("/tasks", {
    query: { mine: p.mine, matterId: p.matterId, status: p.status, range: p.range },
    signal,
  });

export const createTask = (body: {
  title: string;
  matterId?: string | null;
  assigneeId?: string | null;
  priority?: TaskPriority;
  dueAt?: string | null;
}) => httpClient<TaskRow>("/tasks", { method: "POST", body });

export const updateTask = (id: string, body: Partial<Omit<TaskRow, "id">>) =>
  httpClient<TaskRow>(`/tasks/${id}`, { method: "PATCH", body });

export const completeTask = (id: string) => httpClient<TaskRow>(`/tasks/${id}/complete`, { method: "POST" });

export const assignTask = (id: string, assigneeId: string | null) =>
  httpClient<TaskRow>(`/tasks/${id}/assign`, { method: "POST", body: { assigneeId } });
