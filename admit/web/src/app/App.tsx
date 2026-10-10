import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/Toast";
import { ApiError } from "@/services/http";
import { DEFAULT_ORG } from "@/config/env";
import { CustomerLayout } from "@/features/customer/CustomerLayout";
import { HomePage } from "@/features/customer/HomePage";
import { EventsPage } from "@/features/customer/EventsPage";
import { EventPage } from "@/features/customer/EventPage";
import { DetailsPage } from "@/features/customer/DetailsPage";
import { PaymentPage } from "@/features/customer/PaymentPage";
import { UploadPage } from "@/features/customer/UploadPage";
import { SubmittedPage } from "@/features/customer/SubmittedPage";
import { StatusPage } from "@/features/customer/StatusPage";
import { TicketPage } from "@/features/customer/TicketPage";
import { FindBookingPage } from "@/features/customer/FindBookingPage";
import { NotFoundPage } from "./NotFoundPage";
import { QrLandingPage } from "./QrLandingPage";

// The organizer dashboard and the door scanner are separate bundles: customers never download them.
const AdminApp = lazy(() => import("@/features/admin/AdminApp"));
const ScannerApp = lazy(() => import("@/features/scanner/ScannerApp"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // 4xx answers are final (wrong link, no permission); only network trouble and 5xx are worth retrying.
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
});

function Booting() {
  return (
    <p role="status" aria-busy="true" className="p-8 text-sm text-ink-2">
      Loading…
    </p>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<Booting />}>
            <Routes>
              <Route path="/" element={<Navigate to={`/e/${DEFAULT_ORG}`} replace />} />
              <Route path="/e/:org" element={<CustomerLayout />}>
                <Route index element={<HomePage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="events/:event" element={<EventPage />} />
                <Route path="events/:event/details" element={<DetailsPage />} />
                <Route path="find" element={<FindBookingPage />} />
              </Route>
              {/* Booking links from emails: /b/<org>/<ref>?k=<secret> and /t/<org>/<ref>?k=<secret> */}
              <Route path="/b/:org/:ref" element={<CustomerLayout />}>
                <Route index element={<StatusPage />} />
                <Route path="pay" element={<PaymentPage />} />
                <Route path="upload" element={<UploadPage />} />
                <Route path="submitted" element={<SubmittedPage />} />
              </Route>
              <Route path="/t/:org/:ref" element={<CustomerLayout />}>
                <Route index element={<TicketPage />} />
              </Route>
              <Route path="/q/:token" element={<QrLandingPage />} />
              <Route path="/admin/*" element={<AdminApp />} />
              <Route path="/scan/*" element={<ScannerApp />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
