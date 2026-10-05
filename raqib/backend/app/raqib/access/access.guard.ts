import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Forbidden, Unauthenticated } from "@core/kernel/errors.js";
import type { RequestWithPrincipal } from "@core/http/principal.js";
import type { ModuleKey } from "@raqib/raqib/shared/modules.js";
import { requireCan, type Access } from "./access.js";
import { AccessService } from "./application/access-service.js";

const ALLOW_KEY = "raqib:allow";
interface AllowMeta {
  module?: ModuleKey;
  letter?: string;
}

/**
 * Declare what a route needs from the caller's permission template, e.g. `@Allow("visits", "V")`.
 * `@Allow()` with no arguments only requires an active Raqib profile. The guard is the FIRST gate;
 * the application service still checks project scope and object rules.
 */
export const Allow = (module?: ModuleKey, letter?: string) => SetMetadata(ALLOW_KEY, { module, letter } satisfies AllowMeta);

type RequestWithAccess = RequestWithPrincipal & { raqib?: Access };

/** The caller's resolved `Access` (set by `AccessGuard`). */
export const Caller = createParamDecorator((_d: unknown, ctx: ExecutionContext): Access => {
  const req = ctx.switchToHttp().getRequest<RequestWithAccess>();
  if (!req.raqib) throw Unauthenticated();
  return req.raqib;
});

/** Runs after `JwtAuthGuard`: resolves live authority and enforces the declared module/letter. */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithAccess>();
    if (!req.principal) throw Unauthenticated();
    const meta = this.reflector.getAllAndOverride<AllowMeta | undefined>(ALLOW_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!meta) throw Forbidden("raqib.undeclared", "Route has no access declaration."); // fail closed
    const access = await this.access.resolve(req.principal);
    if (meta.module && meta.letter) requireCan(access, meta.module, meta.letter);
    req.raqib = access;
    return true;
  }
}
