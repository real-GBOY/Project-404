import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/app/layouts/app-shell";
import { LoginPage } from "@/features/auth/login-page";
import { AboutPage } from "@/features/landing/pages/about-page";
import { CareersPage } from "@/features/landing/pages/careers-page";
import { ContactPage } from "@/features/landing/pages/contact-page";
import { PrivacyPage } from "@/features/landing/pages/privacy-page";
import { TermsPage } from "@/features/landing/pages/terms-page";
import { ProtectedRoute } from "./protected-route";
import { RootRoute } from "./root-route";
import { NotFoundPage } from "./not-found-page";
import { PlaceholderPage } from "./placeholder-page";
import { DashboardPage } from "@/features/dashboard";
import { EntityTablePage } from "@/features/shared/entity-table-page";
import { PipelinePage } from "@/features/crm/pages/pipeline-page";
import { CustomerDetailPage } from "@/features/crm/pages/customer-detail-page";
import { LeadDetailPage } from "@/features/crm/pages/lead-detail-page";
import { UnitsPage } from "@/features/properties/pages/units-page";
import { ProjectDetailPage } from "@/features/properties/pages/project-detail-page";
import { PaymentPlansPage } from "@/features/sales/pages/payment-plans-page";
import { AnalyticsPage } from "@/features/analytics/pages/analytics-page";
import { AgentPerformancePage } from "@/features/analytics/pages/agent-performance-page";
import { WorkflowsApprovalsPage } from "@/features/operations/pages/workflows-approvals-page";
import { DocumentsPage } from "@/features/operations/pages/documents-page";
import { FeedPage } from "@/features/ai/pages/feed-page";
import { CopilotPage } from "@/features/ai/pages/copilot-page";
import { MessagesPage } from "@/features/messages/pages/messages-page";
import { OrgSettingsPage } from "@/features/admin/pages/org-settings-page";

/** A real route change (different pathname) lands at the top of the new page,
 *  same as a fresh document load — React Router doesn't do this on its own.
 *  A same-page hash change (a footer/nav link to "/#domains" while already on
 *  "/") is left alone: `LandingPage`'s own effect smooth-scrolls to that
 *  section, and this would otherwise fight it back to the top first. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

/**
 * Route tree. Every CRM/Sales/Finance/Ops-list/Admin-list route renders the
 * SAME generic `EntityTablePage`, parameterized by an `entity` key that
 * resolves a `TABLE_CONFIGS` entry (columns/filters/kpis) plus its mock rows
 * — mirrors the design's own `TABLES()`-driven `isTable` screen.
 */
export function AppRouter() {
  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="about" element={<AboutPage />} />
      <Route path="careers" element={<CareersPage />} />
      <Route path="contact" element={<ContactPage />} />
      <Route path="privacy" element={<PrivacyPage />} />
      <Route path="terms" element={<TermsPage />} />

      <Route element={<ProtectedRoute />}>
      <Route element={<AppShell />}>
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Communication — Core real-time messaging */}
        <Route path="messages">
          <Route index element={<MessagesPage />} />
          <Route path=":conversationId" element={<MessagesPage />} />
        </Route>

        {/* CRM */}
        <Route path="leads">
          <Route index element={<EntityTablePage entity="leads" />} />
          <Route path=":id" element={<LeadDetailPage />} />
        </Route>
        <Route path="customers">
          <Route index element={<EntityTablePage entity="customers" />} />
          <Route path=":id" element={<CustomerDetailPage />} />
        </Route>
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="activities" element={<EntityTablePage entity="activities" />} />
        <Route path="followups" element={<EntityTablePage entity="followups" />} />

        {/* Properties */}
        <Route path="projects">
          <Route index element={<EntityTablePage entity="projects" />} />
          <Route path=":id" element={<ProjectDetailPage />} />
        </Route>
        <Route path="buildings" element={<EntityTablePage entity="buildings" />} />
        <Route path="units" element={<UnitsPage />} />
        <Route path="availability" element={<EntityTablePage entity="availability" />} />
        <Route path="pricing" element={<EntityTablePage entity="pricing" />} />

        {/* Sales */}
        <Route path="reservations" element={<EntityTablePage entity="reservations" />} />
        <Route path="deals" element={<EntityTablePage entity="deals" />} />
        <Route path="contracts" element={<EntityTablePage entity="contracts" />} />
        <Route path="plans" element={<PaymentPlansPage />} />
        <Route path="commissions" element={<EntityTablePage entity="commissions" />} />

        {/* Finance */}
        <Route path="payments" element={<EntityTablePage entity="payments" />} />
        <Route path="installments" element={<EntityTablePage entity="installments" />} />
        <Route path="collections" element={<EntityTablePage entity="collections" />} />
        <Route path="outstanding" element={<EntityTablePage entity="outstanding" />} />
        <Route path="finreports" element={<EntityTablePage entity="finreports" />} />

        {/* Operations */}
        <Route path="tasks" element={<EntityTablePage entity="tasks" />} />
        <Route path="workflows" element={<WorkflowsApprovalsPage />} />
        <Route path="approvals" element={<WorkflowsApprovalsPage />} />
        <Route path="documents" element={<DocumentsPage />} />

        {/* Analytics */}
        <Route path="analytics/sales" element={<AnalyticsPage route="an_sales" />} />
        <Route path="analytics/leads" element={<AnalyticsPage route="an_leads" />} />
        <Route path="analytics/projects" element={<AnalyticsPage route="an_project" />} />
        <Route path="analytics/revenue" element={<AnalyticsPage route="an_revenue" />} />
        <Route path="analytics/inventory" element={<AnalyticsPage route="an_inventory" />} />
        <Route path="analytics/agents" element={<AgentPerformancePage />} />

        {/* AI */}
        <Route path="copilot" element={<CopilotPage />} />
        <Route path="insights" element={<FeedPage kind="insights" />} />
        <Route path="recommendations" element={<FeedPage kind="recos" />} />

        {/* Administration */}
        <Route path="team" element={<EntityTablePage entity="team" />} />
        <Route path="roles" element={<EntityTablePage entity="roles" />} />
        <Route path="settings/organization" element={<OrgSettingsPage />} />
        <Route path="audit" element={<EntityTablePage entity="audit" />} />

        <Route path="placeholder" element={<PlaceholderPage title="Coming soon" />} />
      </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </>
  );
}
