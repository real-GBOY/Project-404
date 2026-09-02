import { http, HttpResponse } from "msw";
import type { LoginResponse, MeResponse } from "@/types/auth";
import type { NotificationList } from "@/features/notifications/types/notification";
import {
  DEV_ORGS,
  DEV_PERMS,
  DEV_REFRESH_TOKEN,
  DEV_USER,
  makeDevAccessToken,
} from "../dev-session";

/**
 * Dev-only session + notifications handlers (F2/F3). These endpoints are real on
 * the backend; this file is a local shim, removed once a backend is reachable.
 * Sign in with any email + any 10+ character password.
 */

let activeOrg: string | null = DEV_ORGS[0].organizationId;

function appError(status: number, code: string, message: string) {
  return HttpResponse.json({ code, message }, { status });
}

const NOTIFICATIONS: NotificationList = {
  unreadCount: 3,
  items: [
    {
      id: "ntf_1",
      type: "hearing.scheduled",
      title: "Hearing scheduled — Al-Nour Trading v. Delta Bank",
      body: "Cairo Economic Court, Sunday 09:30",
      readAt: null,
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
      href: "/matters/mat_1",
    },
    {
      id: "ntf_2",
      type: "task.assigned",
      title: "Task assigned — Draft settlement memo",
      body: "Due in 2 days",
      readAt: null,
      createdAt: new Date(Date.now() - 8 * 3600_000).toISOString(),
    },
    {
      id: "ntf_3",
      type: "invoice.paid",
      title: "Payment received — INV-2026-0142",
      body: "EGP 180,000",
      readAt: null,
      createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
    },
  ],
};

export const sessionHandlers = [
  http.post("/api/auth/login", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      organizationId?: string;
    };
    if (!body.email || !body.password) {
      return appError(400, "request.invalid_body", "The request body is invalid.");
    }
    if (body.password.length < 10) {
      return appError(401, "identity.invalid_credentials", "Incorrect email or password.");
    }
    activeOrg = body.organizationId ?? DEV_ORGS[0].organizationId;
    return HttpResponse.json<LoginResponse>({
      user: DEV_USER,
      tokens: {
        accessToken: makeDevAccessToken(activeOrg),
        refreshToken: DEV_REFRESH_TOKEN,
        expiresIn: 900,
        tokenType: "Bearer",
      },
      organizations: DEV_ORGS,
    });
  }),

  http.get("/api/me", () => {
    if (!activeOrg) return appError(401, "auth.unauthenticated", "Authentication required.");
    return HttpResponse.json<MeResponse>({
      user: DEV_USER,
      organizationId: activeOrg,
      permissions: DEV_PERMS,
    });
  }),

  http.post("/api/auth/refresh", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { organizationId?: string };
    if (body.organizationId) activeOrg = body.organizationId;
    activeOrg ??= DEV_ORGS[0].organizationId;
    return HttpResponse.json({
      tokens: {
        accessToken: makeDevAccessToken(activeOrg),
        refreshToken: DEV_REFRESH_TOKEN,
        expiresIn: 900,
        tokenType: "Bearer",
      },
    });
  }),

  http.post("/api/auth/logout", () => {
    activeOrg = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/auth/password/forgot", () =>
    HttpResponse.json({ message: "If that email is registered, a reset link is on its way." }, { status: 202 }),
  ),

  http.post("/api/auth/password/reset", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { token?: string };
    if (body.token === "expired") {
      return appError(400, "identity.invalid_reset_token", "This reset link is invalid or has expired.");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/auth/email/verify", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { token?: string };
    if (body.token === "bad") {
      return appError(400, "identity.invalid_verification_token", "This verification link is invalid or has expired.");
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/auth/email/resend", () =>
    HttpResponse.json({ message: "If that account needs verification, a new link is on its way." }, { status: 202 }),
  ),

  http.get("/api/lawfirm/notifications", ({ request }) => {
    const unreadOnly = new URL(request.url).searchParams.get("unread") === "true";
    const items = unreadOnly ? NOTIFICATIONS.items.filter((n) => !n.readAt) : NOTIFICATIONS.items;
    return HttpResponse.json<NotificationList>({ items, unreadCount: NOTIFICATIONS.unreadCount });
  }),

  http.post("/api/lawfirm/notifications/read-all", () => {
    NOTIFICATIONS.items.forEach((n) => (n.readAt ??= new Date().toISOString()));
    NOTIFICATIONS.unreadCount = 0;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/lawfirm/notifications/:id/read", ({ params }) => {
    const hit = NOTIFICATIONS.items.find((n) => n.id === params.id);
    if (hit && !hit.readAt) {
      hit.readAt = new Date().toISOString();
      NOTIFICATIONS.unreadCount = Math.max(0, (NOTIFICATIONS.unreadCount ?? 1) - 1);
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
