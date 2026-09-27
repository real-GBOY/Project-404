import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENDPOINTS, http } from "@/config";

export interface HotelSettings {
  hotelName: string;
  timeZone: string;
  currency: "EGP";
  checkInTime: string;
  checkOutTime: string;
  taxRate: number;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export type SettingsPatch = Partial<
  Pick<
    HotelSettings,
    "hotelName" | "checkInTime" | "checkOutTime" | "taxRate" | "address" | "phone" | "email"
  >
>;

export const settingsKeys = { all: ["settings"] as const };

export function useSettings(enabled = true) {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: () => http<HotelSettings>(ENDPOINTS.settings),
    enabled,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SettingsPatch) =>
      http<HotelSettings>(ENDPOINTS.settings, { method: "PATCH", body: patch }),
    onSuccess: (data) => qc.setQueryData(settingsKeys.all, data),
  });
}
