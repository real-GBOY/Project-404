import { Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/login-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { RoomsPage } from "@/features/rooms/rooms-page";
import { GuestsPage } from "@/features/guests/guests-page";
import { GuestProfilePage } from "@/features/guests/guest-profile-page";
import { StaffPage } from "@/features/staff/staff-page";
import { SettingsPage } from "@/features/settings/settings-page";
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
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="guests" element={<GuestsPage />} />
          <Route path="guests/:guestId" element={<GuestProfilePage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
