import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser } from "@core/http/decorators.js";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { ZodQuery } from "@core/http/zod.pipe.js";
import type { Principal } from "@core/http/principal.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { permissionMatches } from "@core/rbac/domain/permission.js";
import { SearchRepository, type SearchHit } from "../infrastructure/search-repository.js";

const searchQuery = z.object({ q: z.string().trim().min(2).max(80) });

/**
 * `GET /hotel/search?q=` — the ⌘K palette. Any signed-in staff member may search, but each group
 * is only searched (and returned) if the caller can read that kind of record — the same
 * permission its own screen requires.
 */
@ApiTags("hotel · search")
@ApiBearerAuth("access-token")
@Controller("hotel/search")
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly repo: SearchRepository) {}

  @Get()
  async search(
    @Query(ZodQuery(searchQuery)) { q }: z.infer<typeof searchQuery>,
    @CurrentUser() user: Principal,
  ) {
    const can = (action: string, resource: string) =>
      user.permissions.some((k) => permissionMatches(k, action, resource));
    const groups: Array<{
      key: string;
      label: string;
      allowed: boolean;
      find: (q: string) => Promise<SearchHit[]>;
    }> = [
      {
        key: "guests",
        label: "Guests",
        allowed: can("read", "guest"),
        find: (x) => this.repo.guests(x),
      },
      {
        key: "reservations",
        label: "Reservations",
        allowed: can("read", "reservation"),
        find: (x) => this.repo.reservations(x),
      },
      {
        key: "rooms",
        label: "Rooms",
        allowed: can("read", "room"),
        find: (x) => this.repo.rooms(x),
      },
      {
        key: "invoices",
        label: "Invoices",
        allowed: can("read", "invoice"),
        find: (x) => this.repo.invoices(x),
      },
      {
        key: "tickets",
        label: "Maintenance",
        allowed: can("read", "maintenance"),
        find: (x) => this.repo.tickets(x),
      },
    ];
    const results = await readInTenant(() =>
      Promise.all(
        groups
          .filter((g) => g.allowed)
          .map(async (g) => ({ key: g.key, label: g.label, items: await g.find(q) })),
      ),
    );
    return { groups: results.filter((g) => g.items.length > 0) };
  }
}
