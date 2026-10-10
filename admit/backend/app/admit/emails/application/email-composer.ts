import { Injectable } from "@nestjs/common";
import { getConfig } from "@core/kernel/config.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { readAdmitConfig } from "@admit/config.js";
import { organizationSlug } from "@admit/admit/shared/organizer-directory.js";
import { accessSecret } from "@admit/admit/shared/secrets.js";
import { EventsRepository, type EventRecord } from "@admit/admit/events/infrastructure/events-repository.js";
import { BookingsRepository, type BookingRecord } from "@admit/admit/bookings/infrastructure/bookings-repository.js";
import { TicketsRepository } from "@admit/admit/tickets/infrastructure/tickets-repository.js";
import { SettingsService } from "@admit/admit/settings/application/settings-service.js";
import { EmailRepository, type EmailType } from "../infrastructure/email-repository.js";

/** "EGP 1,250.00" - money is stored in minor units, formatted once here so the worker never does arithmetic. */
export function formatMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface PublicLinks {
  status: string;
  tickets: string;
  upload: string;
  qr(ticketId: string): string;
}

/**
 * Builds the complete, already-decided payload of every transactional email and queues it in the SAME transaction
 * as the state change behind it. The Python worker renders and sends exactly what is here - it never reads a
 * booking, decides anything or recomputes a total. Placeholder names match the approved design template
 * (`email/ticket-confirmed.html`): {{event_name}}, {{ticket_qr_code_url}}, ...
 */
@Injectable()
export class EmailComposer {
  constructor(
    private readonly emails: EmailRepository,
    private readonly bookings: BookingsRepository,
    private readonly tickets: TicketsRepository,
    private readonly events: EventsRepository,
    private readonly settings: SettingsService,
  ) {}

  /** Links for a booking's guest pages. Uses the booking's derived access secret, so any later email can re-create them. */
  async links(booking: Pick<BookingRecord, "id" | "ref">, orgSlug?: string): Promise<PublicLinks> {
    const slug = orgSlug ?? (await this.orgSlug());
    const web = (readAdmitConfig().publicUrl || getConfig().appUrl).replace(/\/$/, "");
    const api = (readAdmitConfig().apiUrl || getConfig().appUrl).replace(/\/$/, "");
    const k = encodeURIComponent(accessSecret(booking.id));
    const base = `${web}/b/${slug}/${booking.ref}`;
    return {
      status: `${base}?k=${k}`,
      tickets: `${web}/t/${slug}/${booking.ref}?k=${k}`,
      upload: `${base}/upload?k=${k}`,
      qr: (ticketId) => `${api}/api/admit/public/${slug}/bookings/${booking.ref}/tickets/${ticketId}/qr.png?k=${k}`,
    };
  }

  private orgSlug(): Promise<string> {
    return organizationSlug(requireOrganizationId());
  }

  private async base(booking: BookingRecord, event: EventRecord) {
    const [profile, venue] = await Promise.all([this.settings.profile(), this.events.venuesByIds([event.venueId])]);
    const v = venue.get(event.venueId)!;
    const zone = profile.timeZone;
    const date = new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(event.startsAt);
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(event.startsAt);
    const links = await this.links(booking);
    return {
      links,
      common: {
        locale: "en",
        organizer_name: profile.organizerName,
        support_email: event.supportEmail ?? profile.supportEmail ?? "",
        brand_logo_url: profile.logoUrl ?? "",
        booking_reference: booking.ref,
        customer_name: booking.customerName,
        event_name: event.title,
        event_date: date,
        event_time: time,
        event_venue: v.name,
        event_address: [v.address, v.area].filter(Boolean).join(", "),
        event_map_url: v.mapUrl ?? "",
        event_image_url: event.coverUrl ?? "",
        policy_summary: event.policies.refund ?? "",
        status_url: links.status,
        ticket_page_url: links.tickets,
        upload_url: links.upload,
      },
    };
  }

  /** Queue one email. `dedupe` makes the (booking, type, occasion) unique, so a replayed transaction never duplicates it. */
  async queue(
    type: EmailType,
    bookingId: string,
    occasion: string,
    extra: (ctx: { booking: BookingRecord; event: EventRecord; links: PublicLinks }) => Promise<Record<string, unknown>> | Record<string, unknown> = () => ({}),
  ): Promise<void> {
    const booking = await this.bookings.find(bookingId);
    if (!booking) return;
    const event = (await this.events.findEvent(booking.eventId))!;
    const { common, links } = await this.base(booking, event);
    const payload = { ...common, ...(await extra({ booking, event, links })) };
    await this.emails.enqueue({ bookingId, type, to: booking.email, payload, dedupeKey: `${bookingId}:${type}:${occasion}` });
  }

  instructions(bookingId: string) {
    return this.queue("INSTRUCTIONS", bookingId, "created", async ({ booking, event }) => {
      const [lines, methods, types] = await Promise.all([
        this.bookings.lines([booking.id]),
        this.events.listMethods([event.id], true),
        this.events.listTypes([event.id]),
      ]);
      const tn = new Map(types.map((t) => [t.id, t.name]));
      return {
        total: formatMoney(booking.totalMinor, booking.currency),
        hold_expires: new Intl.DateTimeFormat("en-GB", { timeZone: (await this.settings.profile()).timeZone, dateStyle: "full", timeStyle: "short" }).format(
          booking.holdExpiresAt,
        ),
        items: lines.map((l) => ({
          name: tn.get(l.ticketTypeId) ?? "Ticket",
          quantity: l.quantity,
          line_total: formatMoney(l.quantity * l.unitPriceMinor, booking.currency),
        })),
        payment_methods: methods.map((m) => ({ label: m.label, recipient: m.recipientName, identifier: m.identifier, instructions: m.instructions })),
      };
    });
  }

  proofReceived(bookingId: string, submissionId: string) {
    return this.queue("PROOF_RECEIVED", bookingId, submissionId);
  }

  rejected(bookingId: string, submissionId: string, reason: string, canResubmit: boolean) {
    return this.queue("REJECTED", bookingId, submissionId, () => ({ rejection_reason: reason, can_resubmit: canResubmit }));
  }

  expired(bookingId: string) {
    return this.queue("EXPIRED", bookingId, "expired");
  }

  cancelled(bookingId: string) {
    return this.queue("CANCELLED", bookingId, "cancelled");
  }

  /** The confirmation with every ticket's QR. One entry per issued ticket, never merged into one code. */
  ticketsIssued(bookingId: string) {
    return this.queue("TICKETS", bookingId, "issued", async ({ booking, links }) => {
      const [issued, types] = await Promise.all([this.tickets.forBookings([booking.id]), this.events.listTypes([booking.eventId])]);
      const tn = new Map(types.map((t) => [t.id, t.name]));
      const live = issued.filter((t) => t.status !== "REVOKED");
      return {
        ticket_count: live.length,
        total: formatMoney(booking.totalMinor, booking.currency),
        tickets: live.map((t) => ({
          ticket_id: t.id,
          ticket_holder_name: t.holderName,
          ticket_type: tn.get(t.ticketTypeId) ?? "Ticket",
          ticket_qr_code_url: links.qr(t.id),
          ticket_url: links.tickets,
        })),
      };
    });
  }

  /** A fresh magic link on request. Not deduplicated by booking alone: every request is a new occasion. */
  magicLink(bookingId: string, requestId: string) {
    return this.queue("MAGIC_LINK", bookingId, requestId);
  }
}
