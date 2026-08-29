import type { onRequestHookHandler } from "fastify";
import { patchContext } from "../../kernel/logging/context.js";
import { directionOf, negotiateLocale } from "../domain/locale.js";

declare module "fastify" {
  interface FastifyRequest {
    locale?: string;
  }
}

export interface LocaleHookOptions {
  supported: string[];
  fallback: string;
}

/**
 * Resolves the request locale once, from (in order): `?locale=`, the
 * `Accept-Language` header, then the configured default. Publishes it on the
 * request and the ambient context, and sets `Content-Language` +
 * `X-Content-Direction` so an Arabic-first client can lay out RTL correctly.
 */
export function localeHook(opts: LocaleHookOptions): onRequestHookHandler {
  return async function resolveLocale(req, reply) {
    const query = req.query as Record<string, unknown> | undefined;
    const queryLocale = typeof query?.locale === "string" ? query.locale : null;
    const headerLocales = (req.headers["accept-language"] ?? "")
      .split(",")
      .map((part) => part.split(";")[0]?.trim())
      .filter((x): x is string => Boolean(x));

    const locale = negotiateLocale([queryLocale, ...headerLocales], opts.supported, opts.fallback);
    req.locale = locale;
    patchContext({ locale });
    reply.header("Content-Language", locale);
    reply.header("X-Content-Direction", directionOf(locale));
  };
}
