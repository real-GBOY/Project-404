# `core/http` — HTTP infrastructure

> Not to be confused with the top-level `http/` directory, which holds
> hand-runnable `.http` request files.

## 1. What it is

The framework glue that turns a NestJS/Fastify request into the pipeline every
controller relies on: `SecurityModule` bundling the auth guard, the permission
guard, the Zod validation pipe, the `AppError → HTTP status` exception filter,
the request-context middleware (correlation id + tenant), and the `@CurrentUser`
/ `@RequirePermission` decorators.

## 2. Why it exists

Controllers must be **thin** (Plan §47 rule 7). The recurring steps —
authenticate, set tenant context, authorize, validate, map errors — belong in
reusable middleware/guards/pipes, not copied into every handler.

## 3. What problem it solves

- `request → authn → tenant context → authz → validation → use case → response`
  applied uniformly, declaratively.
- One error contract: every `AppError` becomes a consistent
  `{ code, message, details }` body with the right status.
- Correlation ids threaded from the first middleware through logs, DB, events,
  and audit.

## 4. Responsibilities

- `jwt-auth.guard.ts` (`JwtAuthGuard`) — verify the bearer token via
  `JWT_SERVICE`, attach a `Principal` (`userId`, `organizationId`,
  `permissions`).
- `permission.guard.ts` (`PermissionGuard` + `@RequirePermission("create:matter")`)
  — call `IPermissionProvider.can()`; `403` if denied.
- `zod.pipe.ts` (`ZodBody` / `ZodQuery` / `ZodParams`) — validate a request part
  against a Zod schema; a failure throws `ValidationError` with
  `details.fields`.
- `app-exception.filter.ts` — `AppError` → status + body; unknown errors → `500`
  + `ERROR_TRACKER.capture`.
- `request-context.middleware.ts` — generate/propagate the correlation id, set
  the tenant context for the request, run the handler inside it.
- `decorators.ts` — `@CurrentUser()`, `@RequirePermission()`.
- `principal.ts` — the `Principal` shape.
- `security.module.ts` — wires the above as `APP_GUARD` / `APP_FILTER` / global
  middleware.

## 5. What it owns

The `Principal` shape, the error-response contract, the request-context
mechanism, and the guard/pipe/filter/decorator set.

## 6. What it explicitly does NOT own

- **Routes** — controllers live in each module's `api/`.
- **What a permission means** (`core/rbac`) or **who a user is**
  (`core/identity`) — the guards *call* those.
- **The HTTP server / adapter choice** — the composition root does
  `NestFactory.create(AppModule, new FastifyAdapter())`.
- API versioning (`/api/v1`) — a destination item; mounted at `/api` today.

## 7. Public surface

- `SecurityModule` (imported once by the composition root).
- `JwtAuthGuard`, `PermissionGuard`, `@RequirePermission`, `@CurrentUser`,
  `ZodBody` / `ZodQuery` / `ZodParams`, `Principal`.

## 8. How to use

```ts
@Controller("matters")
@UseGuards(JwtAuthGuard)
export class MattersController {
  @Post()
  @RequirePermission("create:matter")
  create(
    @CurrentUser() user: Principal,
    @Body(ZodBody(createMatterSchema)) input: CreateMatter,
  ) {
    return this.service.open(user.userId, input);   // thin: one call, no logic
  }
}
```

The tenant context is already set by the middleware — the use case reads it via
`ITenantContext`; the controller does not pass `organizationId`.

## 9. Dependencies & direction

Imports `IdentityModule` (`JWT_SERVICE`), `RbacModule` (`PERMISSION_PROVIDER`),
`kernel` (`TENANT_CONTEXT`, `ERROR_TRACKER`, logging). Consumed by every
controller in Core and `app/`. Nothing depends on `core/http` internals.

## 10. Invariants

1. Controllers contain **no business logic** — validate + delegate + return.
2. Order is fixed: authn → tenant context → authz → validation → use case.
3. Every thrown error is an `AppError`; the filter is the only place status codes
   are decided.
4. `403` (authenticated, not allowed) is distinct from `401` (not
   authenticated).
5. A client-supplied `organizationId` in a body/query is **never** trusted for
   scoping — the tenant comes from the token/context.
6. Every request has a correlation id from the first middleware.

## 11. Example — the error contract

```
throw Forbidden("matter.forbidden", "You can't close matters.")
  → 403 { "code": "matter.forbidden", "message": "You can't close matters." }

ZodBody failure
  → 400 { "code": "request.invalid_body", "message": "…",
          "details": { "fields": [{ "path": "email", "message": "A valid email is required." }] } }
```

The web client's `ApiError` (`web/src/lib/api/api-error.ts`) parses exactly this
shape.

## 12. Testing expectations

`core/tests/`: missing/invalid token → `401`; valid token, missing permission →
`403`; malformed body → `400` with `details.fields`; an `AppError` maps to its
status; an unexpected throw → `500` + tracker call; a forged `organizationId`
does not change scoping.

## 13. When NOT to extend it

- To add business rules to a guard — guards answer authn/authz only.
- To introduce `/api/v1` versioning before a second client or a breaking change
  makes it real.
- To let controllers reach past the use-case layer into repositories.
