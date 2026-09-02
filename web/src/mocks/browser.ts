import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
import { seedDevSession } from "./dev-session";

export const worker = setupWorker(...handlers);

/** Start MSW unless VITE_API_MOCKS=off. Called from main.tsx before render. */
export async function enableMocks(): Promise<void> {
  if (import.meta.env.VITE_API_MOCKS === "off") return;
  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
  // Dev shim — see dev-session.ts. Superseded by F3's real login flow.
  seedDevSession();
}
