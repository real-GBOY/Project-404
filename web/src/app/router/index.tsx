import { Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/app/layouts/app-shell";
import { AuthLayout } from "@/app/layouts/auth-layout";
import { NotFoundPage } from "@/components/feedback/not-found-page";
import { ProtectedRoute } from "./protected-route";
import { RequirePermission } from "./require-permission";
import { PlaceholderPage } from "./placeholder-page";

/** Auth screens are placeholders until F3. */
function AuthPlaceholder({ label }: { label: string }) {
  return <div className="text-[13px] text-muted">{label} — F3</div>;
}

/**
 * Route tree. Feature pages are placeholders until their phase (F4+); the shell,
 * session guard, permission gates and breadcrumb are live now.
 *
 * `<RequirePermission>` is used as a layout route (renders `<Outlet>` when
 * allowed, `<ForbiddenState>` otherwise) so list + detail share one gate.
 */
export function AppRouter() {
  const { t } = useTranslation("common");

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<AuthPlaceholder label={t("nav.dashboard")} />} />
        <Route path="/login/organization" element={<AuthPlaceholder label="Organization" />} />
        <Route path="/login/forgot" element={<AuthPlaceholder label="Forgot password" />} />
        <Route path="/login/reset" element={<AuthPlaceholder label="Reset password" />} />
        <Route path="/login/verify" element={<AuthPlaceholder label="Verify email" />} />
      </Route>

      <Route element={<ProtectedRoute />}>
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

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
