import { createHash } from "node:crypto";
import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from "@nestjs/common";
import { catchError, from, mergeMap, type Observable } from "rxjs";
import { AppError } from "@core/kernel/errors.js";
import { AccountService } from "../application/account-service.js";

type Body = { email?: unknown; password?: unknown; otp?: unknown; token?: unknown };

/**
 * Raqib's rules around Core's sign-in and password-reset routes, applied without touching Core:
 *  - sign-in: a locked address is refused first; a person with a second factor must present a code (after the
 *    password proves right); wrong passwords and wrong codes are counted and lock the address (organization setting
 *    `security.lockout`); success clears the count;
 *  - password reset: the new password must meet the organization's minimum length, and a successful reset stamps the
 *    password age used for rotation.
 */
@Injectable()
export class AuthSecurityInterceptor implements NestInterceptor {
  constructor(private readonly account: AccountService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = ctx.switchToHttp().getRequest<{ method: string; url: string; body?: Body }>();
    if (req.method !== "POST") return next.handle();
    const path = req.url.split("?")[0]!.replace(/^\/api/, "");
    if (path === "/auth/login") return this.login(req.body ?? {}, next);
    if (path === "/auth/password/reset") return this.reset(req.body ?? {}, next);
    return next.handle();
  }

  private async login(body: Body, next: CallHandler): Promise<Observable<unknown>> {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return next.handle();
    await this.account.assertNotLocked(email);
    await this.account.requireSecondFactor(email, body.password, body.otp);
    return next.handle().pipe(
      mergeMap((res) => from(this.account.recordSuccess(email).then(() => res))),
      catchError((err: unknown) => {
        const counted = err instanceof AppError && err.code === "identity.invalid_credentials";
        return from(
          (counted ? this.account.recordFailure(email) : Promise.resolve()).then(() => {
            throw err;
          }),
        );
      }),
    );
  }

  private async reset(body: Body, next: CallHandler): Promise<Observable<unknown>> {
    if (typeof body.token !== "string" || typeof body.password !== "string") return next.handle();
    const owner = await this.account.resetTokenOwner(createHash("sha256").update(body.token).digest("hex"));
    if (!owner) return next.handle(); // Core answers "invalid or expired link"
    await this.account.assertPasswordMeetsPolicy(body.password, owner.organizationId, owner.userId);
    return next.handle().pipe(mergeMap((res) => from(this.account.markPasswordChanged(owner.userId).then(() => res))));
  }
}
