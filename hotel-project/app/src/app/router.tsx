import { Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/login-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { RoomsPage } from "@/features/rooms/rooms-page";
import { GuestsPage } from "@/features/guests/guests-page";
import { GuestProfilePage } from "@/features/guests/guest-profile-page";
import { StaffPage } from "@/features/staff/staff-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { ReservationsPage } from "@/features/reservations/reservations-page";
import { ReservationDetailPage } from "@/features/reservations/reservation-detail-page";
import { NewReservationPage } from "@/features/reservations/new-reservation-page";
import { CalendarPage } from "@/features/calendar/calendar-page";
import { RatesPage } from "@/features/rates/rates-page";
import { FrontDeskPage } from "@/features/front-desk/front-desk-page";
import { InvoicePage } from "@/features/billing/invoice-page";
import { HousekeepingPage } from "@/features/housekeeping/housekeeping-page";
import { MaintenancePage } from "@/features/maintenance/maintenance-page";
import { TicketDetailPage } from "@/features/maintenance/ticket-detail-page";
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
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="reservations/new" element={<NewReservationPage />} />
          <Route path="reservations/:reservationId" element={<ReservationDetailPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="front-desk" element={<FrontDeskPage />} />
          <Route path="invoices/:invoiceId" element={<InvoicePage />} />
          <Route path="rooms" element={<RoomsPage />} />
          <Route path="housekeeping" element={<HousekeepingPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="maintenance/:ticketId" element={<TicketDetailPage />} />
          <Route path="guests" element={<GuestsPage />} />
          <Route path="guests/:guestId" element={<GuestProfilePage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="rates" element={<RatesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
