import type { StatusTone } from "@/components/ui/StatusBadge";
import type { MatterListItem, MatterStatus } from "./types";

export type MatterDisplayStatus = "active" | "hearingSet" | "onHold" | "closed";

/** Header status for the detail screen, where only the raw status is known. */
export function matterStatusFromRaw(status: MatterStatus): MatterDisplayStatus {
  if (status === "on_hold") return "onHold";
  if (status === "closed") return "closed";
  return "active";
}

/**
 * The backend's `MatterStatus` is only `open | on_hold | closed` — the
 * design's richer per-card badges ("Active", "Hearing set", "Filing due")
 * are a presentation layer on top of that. There's no per-matter "filing
 * due" signal on the list endpoint (would need a per-matter deadline
 * lookup), so this derives the two states the list data actually supports
 * honestly: an open matter with a scheduled next hearing reads "Hearing
 * set", otherwise "Active".
 */
export function matterDisplayStatus(matter: MatterListItem): MatterDisplayStatus {
  if (matter.status === "on_hold") return "onHold";
  if (matter.status === "closed") return "closed";
  return matter.nextHearingAt ? "hearingSet" : "active";
}

export const MATTER_STATUS_TONE: Record<MatterDisplayStatus, StatusTone> = {
  active: "info",
  hearingSet: "neutral",
  onHold: "warning",
  closed: "neutral",
};

export const MATTER_STATUS_LABEL: Record<MatterDisplayStatus, string> = {
  active: "Active",
  hearingSet: "Hearing set",
  onHold: "On hold",
  closed: "Closed",
};
