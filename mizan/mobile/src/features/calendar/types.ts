/** Ported from mizan/web/src/features/calendar/api/calendar.api.ts. */
export interface CalendarItem {
  id: string;
  kind: "hearing" | "deadline" | "event";
  eventKind?: string;
  title: string;
  at: string;
  endAt: string | null;
  matterId: string | null;
  matterTitle: string | null;
  owner: string | null;
  ownerId: string | null;
}
