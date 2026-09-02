import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { initI18n } from "@/lib/i18n";
import { AppProviders } from "./providers";
import { AppRouter } from "./router";

/**
 * The app talks only to the real Mizan backend (the Vite dev server proxies
 * `/api` → `http://localhost:3000`). There is no in-browser mock layer: run
 * `MIZAN_SEED_DEMO=true npm run serve` in the repo root for demo data. MSW is
 * used only by the Vitest suite (`src/test/msw/`).
 */
async function bootstrap() {
  await initI18n();

  const root = document.getElementById("root");
  if (!root) throw new Error("#root not found");

  createRoot(root).render(
    <StrictMode>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </StrictMode>,
  );
}

void bootstrap();
