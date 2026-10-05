import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type {
  ConfAccess,
  ConfGrant,
  ConfGrantee,
  ConfKind,
  ConfLogEntry,
  ConfMine,
  ConfReport,
} from "../types";

export const confidentialApi = {
  access: () => http<ConfAccess>(`${ENDPOINTS.conf.base}/access`),
  mine: () => http<{ items: ConfMine[] }>(`${ENDPOINTS.conf.base}/mine`).then((r) => r.items),
  submit: (b: {
    kind: ConfKind;
    subject: string;
    body: string;
    place: string;
    identity: "named" | "confidential" | "anonymous";
    fileIds: string[];
  }) =>
    http<{ id: string | null; ref: string }>(`${ENDPOINTS.conf.base}/reports`, {
      method: "POST",
      body: b,
    }),
  enter: (reason: string, ack: boolean) =>
    http<{ until: string }>(`${ENDPOINTS.conf.base}/session`, {
      method: "POST",
      body: { reason, ack },
    }),
  exit: () => http<void>(`${ENDPOINTS.conf.base}/session/exit`, { method: "POST" }),
  list: () => http<{ items: ConfReport[] }>(`${ENDPOINTS.conf.base}/reports`).then((r) => r.items),
  get: (id: string) => http<ConfReport>(`${ENDPOINTS.conf.base}/reports/${id}`),
  respond: (id: string, text: string) =>
    http<ConfReport>(`${ENDPOINTS.conf.base}/reports/${id}/respond`, {
      method: "POST",
      body: { text },
    }),
  reveal: (id: string, reason: string) =>
    http<ConfReport>(`${ENDPOINTS.conf.base}/reports/${id}/reveal`, {
      method: "POST",
      body: { reason },
    }),
  grants: () => http<{ items: ConfGrant[] }>(`${ENDPOINTS.conf.base}/grants`).then((r) => r.items),
  grantees: () =>
    http<{ items: ConfGrantee[] }>(`${ENDPOINTS.conf.base}/grantees`).then((r) => r.items),
  issue: (b: {
    userId: string;
    level: "view" | "respond";
    scope: "all" | "standard";
    reason: string;
    expiresAt: string;
  }) => http<{ items: ConfGrant[] }>(`${ENDPOINTS.conf.base}/grants`, { method: "POST", body: b }),
  revoke: (id: string, reason: string) =>
    http<{ items: ConfGrant[] }>(`${ENDPOINTS.conf.base}/grants/${id}/revoke`, {
      method: "POST",
      body: { reason },
    }),
  log: () => http<{ items: ConfLogEntry[] }>(`${ENDPOINTS.conf.base}/log`).then((r) => r.items),
};
