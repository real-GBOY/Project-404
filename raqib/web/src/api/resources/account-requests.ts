import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import { allPages } from "../paging";
import type { AccountRequest } from "../types";

export const accountRequestsApi = {
  list: () => allPages<AccountRequest>(ENDPOINTS.accountRequests.list).then((r) => r.items),
  get: (id: string) => http<AccountRequest>(ENDPOINTS.accountRequests.byId(id)),
  approve: (id: string, b: { role: string; projectIds: string[]; comment?: string }) =>
    http<AccountRequest>(ENDPOINTS.accountRequests.step(id, "approve"), {
      method: "POST",
      body: b,
    }),
  reject: (id: string, reason: string) =>
    http<AccountRequest>(ENDPOINTS.accountRequests.step(id, "reject"), {
      method: "POST",
      body: { reason },
    }),
  resend: (id: string) =>
    http<void>(ENDPOINTS.accountRequests.step(id, "resend"), { method: "POST" }),
};
