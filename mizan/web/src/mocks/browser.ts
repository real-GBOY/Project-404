/**
 * Start MSW unless VITE_API_MOCKS=off. Called from main.tsx before render.
 * Everything mock-related is imported dynamically so it forms its own chunk and
 * only ships to clients that actually run the mock layer.
 *
 * Sign in with any email + any 10+ char password (see mocks/handlers/session.ts
 * — a dev shim until a backend is reachable).
 */
export async function enableMocks(): Promise<void> {
  if (import.meta.env.VITE_API_MOCKS === "off") return;
  const [{ setupWorker }, { handlers }] = await Promise.all([
    import("msw/browser"),
    import("./handlers"),
  ]);
  await setupWorker(...handlers).start({
    onUnhandledRequest: "bypass",
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}
