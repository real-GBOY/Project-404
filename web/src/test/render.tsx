/* eslint-disable react-refresh/only-export-components -- test-only helper, not in the HMR graph */
import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { i18n } from "@/lib/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <TooltipProvider delayDuration={0}>
        <ToastProvider>{children}</ToastProvider>
      </TooltipProvider>
    </I18nextProvider>
  );
}

/** Render a component with i18n + tooltip + toast context, and a bound userEvent. */
export function renderWithProviders(ui: ReactElement) {
  return { user: userEvent.setup(), ...render(ui, { wrapper: Wrapper }) };
}
