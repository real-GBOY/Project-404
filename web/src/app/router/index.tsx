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
import { PlaceholderPage } from "./placeholder-page";

/**
 * Route tree.
 *   public          →  login · forgot · reset · verify
 *   authed, no org  →  org selector
 *   authed + org    →  the app shell (feature pages are placeholders until F4+)
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
                  <PlaceholderPage titleKey="dashboard" phase="F4" icon="dashboard" />
                </RequirePermission>
              }
            />

            <Route path="clients" element={<RequirePermission perm="read:client" />}>
              <Route index element={<PlaceholderPage titleKey="clients" phase="F5" icon="groups" />} />
              <Route path=":id" element={<PlaceholderPage titleKey="clients" phase="F5" icon="groups" />} />
            </Route>

            <Route path="matters" element={<RequirePermission perm="read:matter" />}>
              <Route index element={<PlaceholderPage titleKey="matters" phase="F6" icon="gavel" />} />
              <Route path=":id" element={<PlaceholderPage titleKey="matters" phase="F6" icon="gavel" />} />
            </Route>

            <Route
              path="calendar"
              element={
                <RequirePermission perm="read:hearing">
                  <PlaceholderPage titleKey="calendar" phase="F10" icon="calendar_month" />
                </RequirePermission>
              }
            />

            <Route
              path="documents"
              element={
                <RequirePermission perm="read:document">
                  <PlaceholderPage titleKey="documents" phase="F9" icon="folder_open" />
                </RequirePermission>
              }
            />

            <Route path="billing" element={<RequirePermission perm="read:invoice" />}>
              <Route index element={<PlaceholderPage titleKey="finance" phase="F11" icon="payments" />} />
              <Route
                path="invoices/:id"
                element={<PlaceholderPage titleKey="finance" phase="F11" icon="payments" />}
              />
            </Route>

            <Route
              path="team"
              element={
                <RequirePermission perm="read:staff">
                  <PlaceholderPage titleKey="team" phase="F12" icon="badge" />
                </RequirePermission>
              }
            />

            <Route
              path="notifications"
              element={<PlaceholderPage titleKey="notifications" phase="F13" icon="notifications" />}
            />

            <Route path="settings" element={<RequirePermission perm="read:lawfirm_setting" />}>
              <Route index element={<PlaceholderPage titleKey="settings" phase="F14" icon="settings" />} />
              <Route path="users" element={<PlaceholderPage titleKey="settings" phase="F14" icon="settings" />} />
              <Route path="audit" element={<PlaceholderPage titleKey="settings" phase="F14" icon="settings" />} />
              <Route path="locale" element={<PlaceholderPage titleKey="settings" phase="F14" icon="settings" />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
