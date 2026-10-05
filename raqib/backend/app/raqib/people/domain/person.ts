import type { RoleKey } from "@raqib/raqib/shared/modules.js";
import type { L10n } from "@raqib/raqib/shared/l10n.js";

export type PersonStatus = "active" | "invited" | "disabled";

/** What the API returns for an organization member. */
export interface PersonView {
  id: string;
  name: L10n;
  ini: L10n;
  role: RoleKey;
  title: L10n;
  email: string;
  employeeNo: string | null;
  status: PersonStatus;
  lastActiveAt: string | null;
  /** `"all"` for roles scoped to every project, otherwise the active assigned project ids. */
  scope: "all" | string[];
}
