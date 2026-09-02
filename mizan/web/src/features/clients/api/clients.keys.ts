import type { ClientListParams } from "../types/client";

export const clientKeys = {
  all: ["clients"] as const,
  list: (params: ClientListParams) => [...clientKeys.all, "list", params] as const,
  detail: (id: string) => [...clientKeys.all, "detail", id] as const,
  tab: (id: string, tab: string) => [...clientKeys.all, "detail", id, tab] as const,
};
