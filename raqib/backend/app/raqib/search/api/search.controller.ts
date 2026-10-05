import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "@core/http/jwt-auth.guard.js";
import { Allow, AccessGuard, Caller } from "@raqib/raqib/access/access.guard.js";
import type { Access } from "@raqib/raqib/access/access.js";
import { SearchService } from "../application/search-service.js";

@ApiTags("raqib · search")
@ApiBearerAuth("access-token")
@Controller("raqib/search")
@UseGuards(JwtAuthGuard, AccessGuard)
export class SearchController {
  constructor(private readonly service: SearchService) {}

  /** Scope- and permission-filtered search. Confidential reports are never a source. */
  @Get()
  @Allow()
  async search(@Query("q") q: string | undefined, @Caller() who: Access) {
    return { items: await this.service.run((q ?? "").slice(0, 100), who) };
  }
}
