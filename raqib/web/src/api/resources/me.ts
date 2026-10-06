import { ENDPOINTS } from "@/config";
import { http } from "@/services/http";
import type { Me } from "../types";

export const meApi = () => http<Me>(ENDPOINTS.me);
