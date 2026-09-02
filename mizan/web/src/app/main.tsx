import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { initI18n } from "@/lib/i18n";
import { enableMocks } from "@/mocks/browser";
import { AppProviders } from "./providers";
import { AppRouter } from "./router";

async function bootstrap() {
  await initI18n();
  await enableMocks();

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
