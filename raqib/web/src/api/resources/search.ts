import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { SearchHit } from "../types";

export const searchApi = (q: string) =>
  http<{ items: SearchHit[] }>(ENDPOINTS.search(q)).then((r) => r.items);
