import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

/**
 * Start MSW unless VITE_API_MOCKS=off. Called from main.tsx before render.
 * The app boots at `/login`; sign in with any email + any 10+ char password
 * (see mocks/handlers/session.ts — a dev shim until a backend is reachable).
 */
export async function enableMocks(): Promise<void> {
  if (import.meta.env.VITE_API_MOCKS === "off") return;
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}
