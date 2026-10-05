import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import type { FastifyReply } from "fastify";

/** Nothing from the confidential area may be cached by the browser or a proxy. */
@Injectable()
export class NoStoreInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    ctx.switchToHttp().getResponse<FastifyReply>().header("Cache-Control", "private, no-store");
    return next.handle();
  }
}
