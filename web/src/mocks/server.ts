import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** MSW server for the Vitest environment (src/test/setup.ts). */
export const server = setupServer(...handlers);
