import { lazy, type ComponentType } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/app/layouts/app-shell";
import { AuthLayout } from "@/app/layouts/auth-layout";
import { NotFoundPage } from "@/components/feedback/not-found-page";
import {
  ForgotPasswordPage,
  LoginPage,
  OrganizationSelectPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "@/features/auth";
import { ProtectedRoute } from "./protected-route";
import { RedirectIfAuthed } from "./redirect-if-authed";
import { RequireOrganization } from "./require-organization";
import { RequirePermission } from "./require-permission";

// Feature routes are code-split — the shell + auth ship in the entry bundle, each
// feature loads on first visit (AppShell renders a Suspense fallback).
const named = <M, K extends keyof M>(load: () => Promise<M>, key: K) =>
  lazy(() => load().then((m) => ({ default: m[key] as ComponentType })));

const CaseWorkPage = named(() => import("./case-work-page"), "CaseWorkPage");
const DashboardPage = named(() => import("@/features/dashboard"), "DashboardPage");
const ClientsListPage = named(() => import("@/features/clients"), "ClientsListPage");
const ClientDetailPage = named(() => import("@/features/clients"), "ClientDetailPage");
const MatterDetailPage = named(() => import("@/features/matters"), "MatterDetailPage");
const DocumentsListPage = named(() => import("@/features/documents"), "DocumentsListPage");
const CalendarPage = named(() => import("@/features/calendar"), "CalendarPage");
const FinancePage = named(() => import("@/features/billing"), "FinancePage");
const InvoiceDetailPage = named(() => import("@/features/billing"), "InvoiceDetailPage");
const TeamPage = named(() => import("@/features/team"), "TeamPage");
const TeamMemberPage = named(() => import("@/features/team"), "TeamMemberPage");
const NotificationsPage = named(() => import("@/features/notifications"), "NotificationsPage");
const SettingsLayout = named(() => import("@/features/settings"), "SettingsLayout");
const FirmProfileSection = named(() => import("@/features/settings"), "FirmProfileSection");
const PracticeSection = named(() => import("@/features/settings"), "PracticeSection");
const BillingSection = named(() => import("@/features/settings"), "BillingSection");
const AssistantSection = named(() => import("@/features/settings"), "AssistantSection");
const UsersRolesSection = named(() => import("@/features/settings"), "UsersRolesSection");
const AuditSection = named(() => import("@/features/settings"), "AuditSection");
const LocaleSection = named(() => import("@/features/settings"), "LocaleSection");

/**
 * Route tree.
 *   public          →  login · forgot · reset · verify
 *   authed, no org  →  org selector
 *   authed + org    →  the app shell + code-split feature routes
 *
 * `<RequirePermission>` is used as a layout route (renders `<Outlet>` when
 * allowed, `<ForbiddenState>` otherwise) so list + detail share one gate.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/forgot" element={<ForgotPasswordPage />} />
        </Route>
        {/* reachable from an email link regardless of session state */}
        <Route path="/login/reset" element={<ResetPasswordPage />} />
        <Route path="/login/verify" element={<VerifyEmailPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login/organization" element={<OrganizationSelectPage />} />
        </Route>

        <Route element={<RequireOrganization />}>
          <Route element={<AppShell />}>
            <Route
              index
              element={
                <RequirePermission perm="read:dashboard">
                  <DashboardPage />
                </RequirePermission>
              }
            />

            <Route path="clients" element={<RequirePermission perm="read:client" />}>
              <Route index element={<ClientsListPage />} />
              <Route path=":id" element={<ClientDetailPage />} />
            </Route>

            <Route path="matters" element={<RequirePermission perm="read:matter" />}>
              <Route index element={<CaseWorkPage />} />
              <Route path=":id" element={<MatterDetailPage />} />
            </Route>

            <Route
              path="calendar"
              element={
                <RequirePermission perm="read:hearing">
                  <CalendarPage />
                </RequirePermission>
              }
            />

            <Route
              path="documents"
              element={
                <RequirePermission perm="read:document">
                  <DocumentsListPage />
                </RequirePermission>
              }
            />

            <Route path="billing" element={<RequirePermission perm="read:invoice" />}>
              <Route index element={<FinancePage />} />
              <Route path="invoices/:id" element={<InvoiceDetailPage />} />
            </Route>

            <Route path="team" element={<RequirePermission perm="read:staff" />}>
              <Route index element={<TeamPage />} />
              <Route path=":userId" element={<TeamMemberPage />} />
            </Route>

            <Route path="notifications" element={<NotificationsPage />} />

            <Route path="settings" element={<SettingsLayout />}>
              <Route
                index
                element={
                  <RequirePermission perm="read:lawfirm_setting">
                    <FirmProfileSection />
                  </RequirePermission>
                }
              />
              <Route
                path="practice"
                element={
                  <RequirePermission perm="read:lawfirm_setting">
                    <PracticeSection />
                  </RequirePermission>
                }
              />
              <Route
                path="billing"
                element={
                  <RequirePermission perm="read:lawfirm_setting">
                    <BillingSection />
                  </RequirePermission>
                }
              />
              <Route
                path="assistant"
                element={
                  <RequirePermission perm="read:lawfirm_setting">
                    <AssistantSection />
                  </RequirePermission>
                }
              />
              <Route
                path="users"
                element={
                  <RequirePermission perm="read:role">
                    <UsersRolesSection />
                  </RequirePermission>
                }
              />
              <Route
                path="audit"
                element={
                  <RequirePermission perm="read:audit_log">
                    <AuditSection />
                  </RequirePermission>
                }
              />
              <Route path="locale" element={<LocaleSection />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
