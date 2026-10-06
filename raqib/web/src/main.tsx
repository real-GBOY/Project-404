import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { loadLang } from "@/i18n/i18n";
import { setUi } from "@/state/ui-store";
import "@/styles/index.css";
import { App } from "@/app/App";
import { ErrorBoundary } from "@/app/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

setUi({ lang: loadLang() });
document.documentElement.lang = loadLang();
document.documentElement.dir = loadLang() === "ar" ? "rtl" : "ltr";

// Installable and available offline: the service worker keeps the app shell (never API data) on the device.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
