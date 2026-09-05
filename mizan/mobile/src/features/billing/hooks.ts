import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";
import { billingKeys } from "./api";

export const useFinanceSummary = (tab: "invoices" | "payments" | "expenses" = "invoices") =>
  useQuery({ queryKey: billingKeys.financeSummary(tab), queryFn: ({ signal }) => api.getFinanceSummary(tab, signal) });

export const useInvoices = (status?: string) =>
  useQuery({ queryKey: billingKeys.invoices(status), queryFn: ({ signal }) => api.listInvoices(status, signal) });

export function useExpenseMutations() {
  const qc = useQueryClient();
  return {
    record: useMutation({
      mutationFn: api.recordExpense,
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["expenses"] });
        qc.invalidateQueries({ queryKey: ["finance"] });
      },
    }),
  };
}
