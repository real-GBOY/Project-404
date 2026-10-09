import { accessHandlers } from "./confidential";
import { adminHandlers } from "./admin";
import { formHandlers } from "./forms";
import { projectHandlers } from "./projects";
import { scoringHandlers } from "./scoring";
import { setupHandlers } from "./setup";
import { qualityHandlers } from "./quality";
import { reviewHandlers } from "./review";
import { trainingHandlers } from "./training";
import type { ModalHandlers } from "./types";
import { visitHandlers } from "./visits";

/** Every dialog's confirm handler, keyed by the dialog kind. A kind without one just closes. */
export const HANDLERS: ModalHandlers = {
  ...visitHandlers,
  ...reviewHandlers,
  ...qualityHandlers,
  ...trainingHandlers,
  ...accessHandlers,
  ...formHandlers,
  ...adminHandlers,
  ...projectHandlers,
  ...setupHandlers,
  ...scoringHandlers,
};
