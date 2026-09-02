import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, RequirePermission } from "../../../../../core/http/decorators.js";
import { JwtAuthGuard } from "../../../../../core/http/jwt-auth.guard.js";
import { PermissionGuard } from "../../../../../core/http/permission.guard.js";
import { ZodBody, ZodQuery } from "../../../../../core/http/zod.pipe.js";
import type { Principal } from "../../../../../core/http/principal.js";
import { ClientsService } from "./clients-service.js";
import {
  createClientSchema,
  createContactSchema,
  listClientsQuery,
  updateClientSchema,
  type CreateClientBody,
  type CreateContactBody,
  type ListClientsQuery,
  type UpdateClientBody,
} from "./clients.schema.js";

@Controller("clients")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Get()
  @RequirePermission("read", "client")
  list(@Query(ZodQuery(listClientsQuery)) q: ListClientsQuery) {
    return this.service.list(q);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission("create", "client")
  create(@Body(ZodBody(createClientSchema)) body: CreateClientBody, @CurrentUser() user: Principal) {
    return this.service.create(body, user.userId);
  }

  @Get(":id")
  @RequirePermission("read", "client")
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  @Patch(":id")
  @RequirePermission("update", "client")
  update(
    @Param("id") id: string,
    @Body(ZodBody(updateClientSchema)) body: UpdateClientBody,
    @CurrentUser() user: Principal,
  ) {
    return this.service.update(id, body, user.userId);
  }

  @Post(":id/archive")
  @RequirePermission("archive", "client")
  archive(@Param("id") id: string, @CurrentUser() user: Principal) {
    return this.service.archive(id, user.userId);
  }

  @Get(":id/contacts")
  @RequirePermission("read", "client")
  contacts(@Param("id") id: string) {
    return this.service.contacts(id);
  }

  @Post(":id/contacts")
  @HttpCode(201)
  @RequirePermission("update", "client")
  addContact(
    @Param("id") id: string,
    @Body(ZodBody(createContactSchema)) body: CreateContactBody,
  ) {
    return this.service.addContact(id, {
      name: body.name,
      role: body.role ?? undefined,
      email: body.email ?? undefined,
      phone: body.phone ?? undefined,
      primary: body.primary,
    });
  }

  @Get(":id/matters")
  @RequirePermission("read", "client")
  matters(@Param("id") id: string) {
    return this.service.matters(id);
  }

  @Get(":id/documents")
  @RequirePermission("read", "client")
  documents(@Param("id") id: string) {
    return this.service.documents(id);
  }

  @Get(":id/billing")
  @RequirePermission("read", "client")
  billing(@Param("id") id: string) {
    return this.service.billing(id);
  }

  @Get(":id/activity")
  @RequirePermission("read", "client")
  activity(@Param("id") id: string) {
    return this.service.activityFeed(id);
  }
}
