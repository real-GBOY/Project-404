import { Inject, Injectable } from "@nestjs/common";
import QRCode from "qrcode";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { currentExecutor, readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { getContext, runAsSystem, runWithContext } from "@core/kernel/logging/context.js";
import { qrPayload, ticketToken } from "@admit/admit/shared/secrets.js";
import { EventsRepository, type EventRecord, type TicketTypeRecord } from "@admit/admit/events/infrastructure/events-repository.js";
import { BookingsService } from "@admit/admit/bookings/application/bookings-service.js";
import { TicketsRepository } from "@admit/admit/tickets/infrastructure/tickets-repository.js";
import { SettingsService } from "@admit/admit/settings/application/settings-service.js";
import { PaymentsService } from "@admit/admit/payments/application/payments-service.js";
import { EmailComposer } from "@admit/admit/emails/application/email-composer.js";
import type { CreateBookingBody } from "@admit/admit/bookings/validation/bookings.schema.js";
import type { ProofPresignBody, SubmitProofBody } from "@admit/admit/payments/validation/payments.schema.js";

const SELLING_FAST_RATIO = 0.2;
/** Never reveal exact large inventory to the public; the UI shows "99+". */
const REMAINING_DISPLAY_CAP = 99;

export type AvailabilityLabel = "available" | "selling_fast" | "sold_out" | "ended";

/**
 * The customer-facing face of the system: what an anonymous visitor may ask. An organizer is named by its organization
 * slug and every call then runs in that organizer's tenant context, so RLS applies exactly as it does for staff.
 * Nothing here returns a payment method before a booking exists, a booking without its magic-link secret, or a ticket
 * token ever.
 */
@Injectable()
export class PublicService {
  constructor(
    private readonly events: EventsRepository,
    private readonly bookings: BookingsService,
    private readonly tickets: TicketsRepository,
    private readonly payments: PaymentsService,
    private readonly settings: SettingsService,
    private readonly composer: EmailComposer,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /**
   * Run `fn` as the named organizer (404 for an unknown slug). The organization is looked up on the system connection - an
   * anonymous visitor isn't a member, so Core's RLS wouldn't show it - and everything in `fn` then runs in that tenant's context.
   */
  async asOrganizer<T>(slug: string, fn: (org: { id: string; slug: string; name: string }) => Promise<T>): Promise<T> {
    const org = await runAsSystem(() =>
      this.uow.transaction(() => currentExecutor().selectFrom("organizations").select(["id", "slug", "name"]).where("slug", "=", slug).executeTakeFirst()),
    );
    if (!org) throw NotFound("admit.organizer_not_found", "Organizer not found.");
    const correlationId = getContext()?.correlationId ?? `public-${slug}`;
    return runWithContext({ correlationId, organizationId: org.id }, () => fn(org));
  }

  // ---- catalogue ------------------------------------------------------------------------------
  private label(types: Array<TicketTypeRecord & { remaining: number }>, event: EventRecord, now: Date): AvailabilityLabel {
    if (event.endsAt <= now) return "ended";
    const sellable = types.filter((t) => t.onSale);
    const total = sellable.reduce((n, t) => n + t.quantity, 0);
    const left = sellable.reduce((n, t) => n + t.remaining, 0);
    if (!sellable.length || left <= 0) return "sold_out";
    return left / Math.max(total, 1) <= SELLING_FAST_RATIO ? "selling_fast" : "available";
  }

  private async cards(events: EventRecord[], now: Date) {
    const ids = events.map((e) => e.id);
    const [venues, types, held] = await Promise.all([
      this.events.venuesByIds([...new Set(events.map((e) => e.venueId))]),
      this.events.listTypes(ids),
      this.events.heldByType(ids),
    ]);
    return events.map((e) => {
      const myTypes = types.filter((t) => t.eventId === e.id).map((t) => ({ ...t, remaining: Math.max(t.quantity - (held.get(t.id) ?? 0), 0) }));
      const v = venues.get(e.venueId)!;
      const prices = myTypes.filter((t) => t.onSale).map((t) => t.priceMinor);
      return {
        card: {
          id: e.id,
          slug: e.slug,
          title: e.title,
          category: e.category,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          coverUrl: e.coverUrl,
          currency: e.currency,
          venue: { name: v.name, area: v.area },
          minPriceMinor: prices.length ? Math.min(...prices) : null,
          availability: this.label(myTypes, e, now),
        },
        types: myTypes,
        venue: v,
      };
    });
  }

  listEvents(slug: string, now: Date) {
    return this.asOrganizer(slug, (org) =>
      readInTenant(async () => {
        const [events, profile] = await Promise.all([this.events.listEvents({ ids: null, status: ["published"] }), this.settings.profile()]);
        const upcoming = events.filter((e) => e.endsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
        const cards = (await this.cards(upcoming, now)).map((c) => c.card);
        const categories = new Map<string, number>();
        for (const c of cards) if (c.category) categories.set(c.category, (categories.get(c.category) ?? 0) + 1);
        return {
          organizer: { slug: org.slug, name: profile.organizerName, supportEmail: profile.supportEmail, logoUrl: profile.logoUrl },
          events: cards,
          categories: [...categories].map(([name, count]) => ({ name, count })),
        };
      }),
    );
  }

  eventDetail(slug: string, eventSlug: string, now: Date) {
    return this.asOrganizer(slug, (org) =>
      readInTenant(async () => {
        const event = await this.events.findEventBySlug(eventSlug);
        if (!event || event.status !== "published") throw NotFound("admit.event_not_found", "Event not found.");
        const [[c], profile] = await Promise.all([this.cards([event], now), this.settings.profile()]);
        return {
          ...c!.card,
          description: event.description,
          program: event.program,
          policies: event.policies,
          namedTickets: event.namedTickets,
          maxPerBooking: event.maxPerBooking,
          venue: { name: c!.venue.name, area: c!.venue.area, address: c!.venue.address, mapUrl: c!.venue.mapUrl },
          organizer: { slug: org.slug, name: profile.organizerName, supportEmail: event.supportEmail ?? profile.supportEmail },
          ticketTypes: c!.types.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            priceMinor: t.priceMinor,
            maxPerBooking: Math.min(t.maxPerBooking, event.maxPerBooking),
            remaining: Math.min(t.remaining, REMAINING_DISPLAY_CAP),
            onSale: t.onSale && t.remaining > 0,
          })),
        };
      }),
    );
  }

  // ---- bookings -------------------------------------------------------------------------------
  async createBooking(slug: string, eventSlug: string, body: CreateBookingBody, idempotencyKey: string | null) {
    return this.asOrganizer(slug, async (org) => {
      const { booking, created } = await this.bookings.create(eventSlug, body, idempotencyKey);
      const links = await readInTenant(() => this.composer.links(booking, org.slug));
      return {
        created,
        ref: booking.ref,
        holdExpiresAt: booking.holdExpiresAt,
        totalMinor: booking.totalMinor,
        currency: booking.currency,
        links: { status: links.status, upload: links.upload },
      };
    });
  }

  booking(slug: string, ref: string, k: string) {
    return this.asOrganizer(slug, () => this.bookings.guestView(ref, k));
  }
  cancel(slug: string, ref: string, k: string) {
    return this.asOrganizer(slug, () => this.bookings.cancelByGuest(ref, k));
  }
  resendLink(slug: string, ref: string, email: string, requestId: string) {
    return this.asOrganizer(slug, () => this.bookings.resendLink(ref, email, requestId));
  }

  // ---- proof ----------------------------------------------------------------------------------
  presign(slug: string, ref: string, k: string, b: ProofPresignBody) {
    return this.asOrganizer(slug, async () => {
      const out = await this.payments.presign(ref, k, b);
      // The local driver's target is the authenticated files route, which a guest cannot call: use Admit's own for this booking.
      if (out.upload.url.startsWith("/")) {
        return {
          fileId: out.fileId,
          upload: {
            ...out.upload,
            url: `/api/admit/public/${slug}/bookings/${ref}/proof/${out.fileId}/bytes?k=${encodeURIComponent(k)}`,
            method: "PUT",
            headers: { "content-type": "application/octet-stream" },
          },
        };
      }
      return out;
    });
  }
  putBytes(slug: string, ref: string, k: string, fileId: string, content: Buffer) {
    return this.asOrganizer(slug, () => this.payments.writeLocalBytes(ref, k, fileId, content));
  }
  submitProof(slug: string, ref: string, k: string, b: SubmitProofBody) {
    return this.asOrganizer(slug, () => this.payments.submit(ref, k, b));
  }

  // ---- tickets --------------------------------------------------------------------------------
  ticketsFor(slug: string, ref: string, k: string) {
    return this.asOrganizer(slug, (org) =>
      readInTenant(async () => {
        const { booking, event } = await this.bookings.guest(ref, k);
        const [list, types, venue, links] = await Promise.all([
          this.tickets.forBookings([booking.id]),
          this.events.listTypes([event.id]),
          this.events.venuesByIds([event.venueId]),
          this.composer.links(booking, org.slug),
        ]);
        const tn = new Map(types.map((t) => [t.id, t.name]));
        const v = venue.get(event.venueId)!;
        return {
          bookingStatus: booking.status,
          event: { title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, venue: { name: v.name, address: v.address, mapUrl: v.mapUrl } },
          tickets: list.map((t) => ({
            id: t.id,
            seq: t.seq,
            holderName: t.holderName,
            ticketType: tn.get(t.ticketTypeId) ?? "",
            status: t.status,
            checkedInAt: t.checkedInAt,
            // The QR is an image the page loads; the token itself never appears in JSON.
            qrImageUrl: t.status === "REVOKED" ? null : links.qr(t.id).replace(/^https?:\/\/[^/]+/, ""),
          })),
        };
      }),
    );
  }

  /** PNG of one ticket's QR: black on white, 4-module quiet zone, error correction M, 400px. */
  qr(slug: string, ref: string, k: string, ticketId: string): Promise<Buffer> {
    return this.asOrganizer(slug, async () => {
      const t = await readInTenant(async () => {
        const { booking } = await this.bookings.guest(ref, k);
        const ticket = (await this.tickets.forBookings([booking.id])).find((x) => x.id === ticketId);
        if (!ticket || ticket.status === "REVOKED") throw NotFound("admit.ticket_not_found", "Ticket not found.");
        return ticket;
      });
      return QRCode.toBuffer(qrPayload(ticketToken(t.id)), {
        type: "png",
        errorCorrectionLevel: "M",
        margin: 4,
        width: 400,
        color: { dark: "#000000", light: "#FFFFFF" },
      });
    });
  }
}
