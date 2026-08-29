import { describe, expect, it } from "vitest";
import { localeHook } from "../middleware/locale-middleware.js";

const OPTS = { supported: ["ar", "en"], fallback: "ar" };

/** Minimal Fastify request/reply doubles — the hook only touches these bits. */
function run(input: {
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
}) {
  const headersSet: Record<string, string> = {};
  const req = { query: input.query ?? {}, headers: input.headers ?? {} } as never;
  const reply = {
    header(name: string, value: string) {
      headersSet[name] = value;
      return this;
    },
  } as never;
  const hook = localeHook(OPTS) as (r: unknown, p: unknown) => Promise<void>;
  return hook(req, reply).then(() => ({ req: req as { locale?: string }, headersSet }));
}

describe("localeHook", () => {
  it("prefers an explicit ?locale query param", async () => {
    const { req } = await run({ query: { locale: "en" }, headers: { "accept-language": "ar" } });
    expect(req.locale).toBe("en");
  });

  it("parses Accept-Language, stripping q-values, when no query param", async () => {
    const { req } = await run({ headers: { "accept-language": "fr-FR,en;q=0.8,ar;q=0.5" } });
    expect(req.locale).toBe("en");
  });

  it("falls back to the configured default when nothing matches", async () => {
    const { req } = await run({ headers: { "accept-language": "de,fr;q=0.9" } });
    expect(req.locale).toBe("ar");
  });

  it("falls back to the default with no signals at all", async () => {
    const { req } = await run({});
    expect(req.locale).toBe("ar");
  });

  it("sets Content-Language and X-Content-Direction to match", async () => {
    const en = await run({ query: { locale: "en" } });
    expect(en.headersSet["Content-Language"]).toBe("en");
    expect(en.headersSet["X-Content-Direction"]).toBe("ltr");

    const ar = await run({ query: { locale: "ar" } });
    expect(ar.headersSet["Content-Language"]).toBe("ar");
    expect(ar.headersSet["X-Content-Direction"]).toBe("rtl");
  });

  it("ignores a non-string locale query param", async () => {
    const { req } = await run({ query: { locale: ["en"] }, headers: { "accept-language": "ar" } });
    expect(req.locale).toBe("ar");
  });
});
