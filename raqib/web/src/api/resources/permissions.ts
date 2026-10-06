import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { PermissionsOverview, TemplateChange } from "../types";

export const permissionsApi = {
  overview: () => http<PermissionsOverview>(ENDPOINTS.permissions),
  apply: (changes: TemplateChange[], reason: string) =>
    http<PermissionsOverview>(ENDPOINTS.permissions, {
      method: "PUT",
      body: { changes, reason },
    }),
};
