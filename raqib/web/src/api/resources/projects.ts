import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { Project } from "../types";

export const projectsApi = {
  list: () => http<{ items: Project[] }>(ENDPOINTS.projects.list).then((r) => r.items),
  get: (id: string) => http<Project>(ENDPOINTS.projects.byId(id)),
};
