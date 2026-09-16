import { z } from "zod";

export const listFinancialReportsQuery = z.object({
  type: z.enum(["collections", "revenue", "receivables", "commissions", "treasury"]).optional(),
  status: z.enum(["draft", "active"]).optional(),
  q: z.string().trim().min(1).max(200).optional(),
});

export const createFinancialReportSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["collections", "revenue", "receivables", "commissions", "treasury"]),
  period: z.string().trim().min(1).max(60),
  ownerId: z.string().min(1),
  schedule: z.enum(["manual", "daily", "weekly", "monthly"]).optional(),
});

export type ListFinancialReportsQuery = z.infer<typeof listFinancialReportsQuery>;
export type CreateFinancialReportBody = z.infer<typeof createFinancialReportSchema>;
