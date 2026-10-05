import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { OrgSettings } from "../types";

export const settingsApi = {
  get: () => http<OrgSettings>(ENDPOINTS.settings),
  update: (settings: OrgSettings, reason: string) =>
    http<OrgSettings>(ENDPOINTS.settings, { method: "PUT", body: { settings, reason } }),
};
