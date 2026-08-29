import type { NextFunction, Request, Response } from "express";
import { patchContext } from "../../kernel/logging/context.js";
import { directionOf, negotiateLocale } from "../domain/locale.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      locale?: string;
    }
  }
}

export interface LocaleMiddlewareOptions {
  supported: string[];
  fallback: string;
}

/**
 * Resolves the request locale once, from (in order): `?locale=`, the
 * `Accept-Language` header, then the configured default. Publishes it on the
 * request and the ambient context, and sets `Content-Language` +
 * `X-Content-Direction` so an Arabic-first client can lay out RTL correctly.
 */
export function localeMiddleware(opts: LocaleMiddlewareOptions) {
  return function resolveLocale(req: Request, res: Response, next: NextFunction): void {
    const queryLocale = typeof req.query.locale === "string" ? req.query.locale : null;
    const headerLocales = (req.headers["accept-language"] ?? "")
      .split(",")
      .map((part) => part.split(";")[0]?.trim())
      .filter((x): x is string => Boolean(x));

    const locale = negotiateLocale([queryLocale, ...headerLocales], opts.supported, opts.fallback);
    req.locale = locale;
    patchContext({ locale });
    res.setHeader("Content-Language", locale);
    res.setHeader("X-Content-Direction", directionOf(locale));
    next();
  };
}
