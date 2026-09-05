import type { IconName } from "@/components/ui/Icon";
import type { StatusTone } from "@/components/ui/StatusBadge";

/** Icon + tone per dotted notification type — mirrors the map in
 *  mizan/web/src/features/notifications/pages/notifications-page.tsx. */
const ICON: Record<string, IconName> = {
  "hearing.scheduled": "gavel",
  "hearing.adjourned": "gavel",
  "task.assigned": "task_alt",
  "invoice.paid": "payments",
  "invoice.overdue": "alarm",
  "payment.received": "payments",
  "matter.update_added": "gavel",
  "document.uploaded": "description",
  "deadline.approaching": "warning",
};

const TONE: Record<string, StatusTone> = {
  "hearing.scheduled": "neutral",
  "hearing.adjourned": "neutral",
  "task.assigned": "neutral",
  "invoice.paid": "success",
  "invoice.overdue": "danger",
  "payment.received": "success",
  "matter.update_added": "neutral",
  "document.uploaded": "warning",
  "deadline.approaching": "danger",
};

export function iconForNotification(type: string): IconName {
  return ICON[type] ?? "notifications";
}

export function toneForNotification(type: string): StatusTone {
  return TONE[type] ?? "neutral";
}

export type NotificationCategory = "hearings" | "deadlines" | "finance" | "other";

/** The backend has no server-side `?type=` filter (confirmed) — bucket
 *  client-side by the dotted type's prefix for the design's filter chips. */
export function categoryForNotification(type: string): NotificationCategory {
  const prefix = type.split(".")[0];
  if (prefix === "hearing") return "hearings";
  if (prefix === "deadline") return "deadlines";
  if (prefix === "invoice" || prefix === "payment") return "finance";
  return "other";
}
