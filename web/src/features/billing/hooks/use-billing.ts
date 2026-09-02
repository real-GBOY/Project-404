import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/components/ui/toast-context";
import { isApiError } from "@/lib/api/api-error";
import * as api from "../api/billing.api";
import { billingKeys } from "../api/billing.api";

export const useInvoices = (status?: string) =>
  useQuery({
    queryKey: billingKeys.invoices(status),
    queryFn: ({ signal }) => api.listInvoices(status, signal),
    placeholderData: (p) => p,
  });

export const useInvoice = (id: string) =>
  useQuery({ queryKey: billingKeys.invoice(id), queryFn: ({ signal }) => api.getInvoice(id, signal) });

export const usePayments = () =>
  useQuery({ queryKey: billingKeys.payments(), queryFn: ({ signal }) => api.listPayments(signal) });

export const useExpenses = (status?: string) =>
  useQuery({
    queryKey: billingKeys.expenses(status),
    queryFn: ({ signal }) => api.listExpenses(status, signal),
    placeholderData: (p) => p,
  });

export function useBillingMutations() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation("billing");
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  return {
    invoiceAction: useMutation({
      mutationFn: ({ id, action }: { id: string; action: "issue" | "send" | "void" }) =>
        api.invoiceAction(id, action),
      onSuccess: (_d, v) => {
        invalidate();
        toast.success({ title: t(`toasts.${v.action}`) });
      },
      onError: () => toast.error({ title: t("toasts.failed") }),
    }),
    recordPayment: useMutation({
      mutationFn: api.recordPayment,
      onSuccess: () => {
        invalidate();
        toast.success({ title: t("toasts.payment_recorded") });
      },
      onError: (e) =>
        toast.error({
          title: isApiError(e) && e.status === 422 ? e.message : t("toasts.failed"),
        }),
    }),
    recordExpense: useMutation({
      mutationFn: api.recordExpense,
      onSuccess: () => {
        invalidate();
        toast.success({ title: t("toasts.expense_recorded") });
      },
      onError: () => toast.error({ title: t("toasts.failed") }),
    }),
    approveExpense: useMutation({
      mutationFn: (id: string) => api.approveExpense(id),
      onSuccess: () => {
        invalidate();
        toast.success({ title: t("toasts.expense_approved") });
      },
      onError: () => toast.error({ title: t("toasts.failed") }),
    }),
  };
}
