import type { TemplateSeed } from "@core/notifications/infrastructure/template-repository.js";

/**
 * HotelOS in-app notification templates, rendered by Core per recipient locale. English only for
 * v1 — adding a language is adding rows here, not touching the code that sends them.
 */
export const HOTEL_TEMPLATES: TemplateSeed[] = [
  {
    key: "hotel.housekeeping_assigned",
    locale: "en",
    channel: "in_app",
    subject: "Room {{room}} is yours to clean",
    body: "{{kind}} · assigned by {{actor}}.",
  },
  {
    key: "hotel.maintenance_assigned",
    locale: "en",
    channel: "in_app",
    subject: "{{number}} assigned to you",
    body: "Room {{room}}: {{title}} ({{priority}}).",
  },
  {
    key: "hotel.maintenance_reported",
    locale: "en",
    channel: "in_app",
    subject: "{{number}} reported — Room {{room}}",
    body: "{{title}} ({{priority}}){{impact}}.",
  },
  {
    key: "hotel.maintenance_resolved",
    locale: "en",
    channel: "in_app",
    subject: "{{number}} is ready to verify",
    body: "Room {{room}}: {{title}} — resolved by {{actor}}.",
  },
  {
    key: "hotel.money_failed",
    locale: "en",
    channel: "in_app",
    subject: "{{what}} declined — #{{code}}",
    body: "{{amount}} for {{guest}}. {{reason}}",
  },
  {
    key: "hotel.reservation_auto",
    locale: "en",
    channel: "in_app",
    subject: "#{{code}} {{what}}",
    body: "{{guest}} · {{reason}}",
  },
];
