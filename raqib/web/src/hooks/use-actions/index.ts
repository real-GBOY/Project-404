import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Actions } from "@/presenters/actions";
import { adminActions } from "./admin";
import { confidentialActions } from "./confidential";
import { documentActions } from "./documents";
import { formActions } from "./forms";
import { inspectionActions } from "./inspection";
import { onboardingActions } from "./onboarding";
import { projectActions } from "./projects";
import { qualityActions } from "./quality";
import { reviewActions } from "./review";
import { trainingActions } from "./training";
import { visitActions } from "./visits";

/**
 * The application layer: each command calls the API, then invalidates exactly the server state it can have changed (so every
 * screen re-reads from the backend rather than patching local copies). Commands live in one file per area of the product;
 * this hook only assembles them into the `Actions` the presenters call.
 */
export function useActions(): Actions {
  const qc = useQueryClient();
  return useMemo<Actions>(
    () => ({
      ...adminActions(qc),
      ...projectActions(qc),
      ...visitActions(qc),
      ...inspectionActions(qc),
      ...reviewActions(qc),
      ...qualityActions(qc),
      ...trainingActions(qc),
      ...confidentialActions(qc),
      ...onboardingActions(qc),
      ...formActions(qc),
      ...documentActions(),
    }),
    [qc],
  );
}
