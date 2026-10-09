import type { L10n } from "./common";

export type SurveyStatus = "draft" | "active" | "closed";
export interface SurveyQuestion {
  key: string;
  type: "rating" | "text";
  text: L10n;
}
export interface Survey {
  id: string;
  title: L10n;
  intro: L10n;
  questions: SurveyQuestion[];
  status: SurveyStatus;
  createdAt: string;
  publishedAt: string | null;
  closedAt: string | null;
}
export interface SurveyList {
  items: Survey[];
  /** The caller is named to manage surveys (drafts and closed ones are visible to them). */
  canManage: boolean;
  /** General Manager only. */
  managers: Array<{ userId: string; name: L10n; at: string }> | null;
  candidates: Array<{ userId: string; name: L10n; role: string }> | null;
}
export interface SurveyInput {
  title: L10n;
  intro: L10n;
  questions: Array<{ type: "rating" | "text"; text: L10n }>;
}
