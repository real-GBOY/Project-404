import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/app/layouts/app-shell";
import { AuthLayout } from "@/app/layouts/auth-layout";
import { NotFoundPage } from "@/components/feedback/not-found-page";
import { WelcomePage } from "./welcome";

/**
 * Route tree. F0: a placeholder shell + login route. Feature routes (lazy, guarded
 * by <ProtectedRoute> + <RequirePermission>) are added from F2 onward.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<div className="text-[13px] text-muted">Login — F3</div>} />
      </Route>

      <Route element={<AppShell />}>
        <Route index element={<WelcomePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
