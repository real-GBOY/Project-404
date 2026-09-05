import { useQuery } from "@tanstack/react-query";
import { getSettings, getAuditLogs, settingsKeys } from "./api";

export const useFirmSettings = () =>
  useQuery({ queryKey: settingsKeys.firm, queryFn: ({ signal }) => getSettings(signal) });

export const useAuditLogs = (q: string) =>
  useQuery({ queryKey: settingsKeys.audit(q), queryFn: ({ signal }) => getAuditLogs(q, signal) });
