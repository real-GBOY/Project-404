import { http, HttpResponse } from "msw";
import type { MeResponse } from "@/types/auth";
import type { NotificationList } from "@/features/notifications/types/notification";
import {
  DEV_PERMS,
  DEV_ORGS,
  DEV_REFRESH_TOKEN,
  DEV_USER,
  makeDevAccessToken,
} from "../dev-session";

/**
 * Dev-only session + notifications handlers (F2). These endpoints are real on
 * the backend; this file is a local shim, removed once a backend is reachable.
 */

let activeOrg = DEV_ORGS[0].organizationId;

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
  http.get("/api/me", () =>
    HttpResponse.json<MeResponse>({
      user: DEV_USER,
      organizationId: activeOrg,
      permissions: DEV_PERMS,
    }),
  ),

  http.post("/api/auth/refresh", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { organizationId?: string };
    if (body.organizationId) activeOrg = body.organizationId;
    return HttpResponse.json({
      tokens: { accessToken: makeDevAccessToken(activeOrg), refreshToken: DEV_REFRESH_TOKEN },
    });
  }),

  http.post("/api/auth/logout", () => new HttpResponse(null, { status: 204 })),

  http.get("/api/notifications", ({ request }) => {
    const unreadOnly = new URL(request.url).searchParams.get("unread") === "true";
    const items = unreadOnly ? NOTIFICATIONS.items.filter((n) => !n.readAt) : NOTIFICATIONS.items;
    return HttpResponse.json<NotificationList>({ items, unreadCount: NOTIFICATIONS.unreadCount });
  }),

  http.post("/api/notifications/read-all", () => {
    NOTIFICATIONS.items.forEach((n) => (n.readAt ??= new Date().toISOString()));
    NOTIFICATIONS.unreadCount = 0;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/api/notifications/:id/read", ({ params }) => {
    const hit = NOTIFICATIONS.items.find((n) => n.id === params.id);
    if (hit && !hit.readAt) {
      hit.readAt = new Date().toISOString();
      NOTIFICATIONS.unreadCount = Math.max(0, (NOTIFICATIONS.unreadCount ?? 1) - 1);
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
