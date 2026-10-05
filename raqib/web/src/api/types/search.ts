/** Global search results. */
import type { L10n } from "./common";

export interface SearchHit {
  kind: "project" | "visit" | "report" | "observation" | "action" | "training" | "guard" | "user";
  id: string;
  ref: string;
  title: L10n | string;
  sub: string;
  go: [string, string];
}
