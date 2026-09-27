import { Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/login-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { AppShell } from "./layouts/app-shell";
import { ProtectedRoute } from "./protected-route";
import { NotFoundPage } from "./not-found-page";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
