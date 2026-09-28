import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENDPOINTS, http } from "@/config";

export interface RateRule {
  id: string;
  name: string;
  kind: "seasonal" | "weekend" | "promotion";
  roomTypeId: string | null;
  startDate: string | null;
  endDate: string | null;
  daysOfWeek: number[] | null;
  adjustmentType: "percent" | "fixed_rate";
  adjustmentValue: number;
  minNights: number | null;
  priority: number;
}

export interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  percentOff: number;
  validFrom: string | null;
  validTo: string | null;
}

export type RateRuleInput = Omit<RateRule, "id">;
export type DiscountInput = Omit<DiscountCode, "id">;

export const pricingKeys = { all: ["rates"] as const };

export function useRates() {
  return useQuery({
    queryKey: pricingKeys.all,
    queryFn: () => http<{ rules: RateRule[]; discounts: DiscountCode[] }>(ENDPOINTS.rates.list),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: pricingKeys.all });
    void qc.invalidateQueries({ queryKey: ["availability"] });
  };
}

export function useCreateRule() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: RateRuleInput) =>
      http(ENDPOINTS.rates.rules, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useCreateDiscount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: DiscountInput) =>
      http(ENDPOINTS.rates.discounts, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

export function useArchiveRate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: "rule" | "discount"; id: string }) =>
      http(
        kind === "rule" ? ENDPOINTS.rates.archiveRule(id) : ENDPOINTS.rates.archiveDiscount(id),
        {
          method: "POST",
        },
      ),
    onSuccess: invalidate,
  });
}
