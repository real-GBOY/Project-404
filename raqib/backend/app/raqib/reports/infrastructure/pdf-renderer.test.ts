import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@core/kernel/errors.js";
import { PdfRenderer } from "./pdf-renderer.js";

/** The Cloudflare driver, with `fetch` stubbed: no request leaves the process. */
const PDF = Buffer.from("%PDF-1.4 fake pdf bytes");
const KEYS = ["RAQIB_CF_ACCOUNT_ID", "RAQIB_CF_API_TOKEN", "RAQIB_CHROMIUM_PATH", "RAQIB_PDF_DRIVER"] as const;
const saved: Record<string, string | undefined> = {};
let calls: Array<{ url: string; init: RequestInit }>;

const reply = (status: number, body: Buffer | string) =>
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(body, { status }));
    }),
  );

beforeEach(() => {
  calls = [];
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.RAQIB_CF_ACCOUNT_ID = "acc123";
  process.env.RAQIB_CF_API_TOKEN = "tok-secret";
  delete process.env.RAQIB_CHROMIUM_PATH;
  delete process.env.RAQIB_PDF_DRIVER;
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("PdfRenderer with Cloudflare Browser Rendering", () => {
  it("is available with credentials and says which driver it uses", () => {
    const r = new PdfRenderer();
    expect(r.available()).toBe(true);
    expect(r.stats().driver).toBe("cloudflare");
  });

  it("posts the report HTML to the account's pdf endpoint with the bearer token and returns the bytes", async () => {
    reply(200, PDF);
    const out = await new PdfRenderer().render("<html><body>تقرير</body></html>");
    expect(out.equals(PDF)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.cloudflare.com/client/v4/accounts/acc123/browser-rendering/pdf");
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer tok-secret");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({
      html: "<html><body>تقرير</body></html>",
      setJavaScriptEnabled: false,
      pdfOptions: { format: "a4", printBackground: true, preferCSSPageSize: true },
    });
  });

  it("turns a rate limit into a retry-later answer, and anything else that is not a pdf into 'unavailable', without leaking the token", async () => {
    reply(429, "slow down");
    await expect(new PdfRenderer().render("<p>x</p>")).rejects.toMatchObject({ code: "raqib.pdf_busy", kind: "rate_limited" });
    reply(403, JSON.stringify({ errors: [{ message: "bad token tok-secret" }] }));
    const err = await new PdfRenderer().render("<p>x</p>").catch((e) => e as AppError);
    expect(err).toMatchObject({ code: "raqib.pdf_failed", kind: "unavailable" });
    expect(String((err as AppError).message)).not.toMatch(/tok-secret/);
    reply(200, "<html>not a pdf</html>");
    await expect(new PdfRenderer().render("<p>x</p>")).rejects.toMatchObject({ code: "raqib.pdf_failed" });
  });

  it("answers 'unavailable' (503), not an internal error, when nothing is configured", async () => {
    delete process.env.RAQIB_CF_API_TOKEN;
    const r = new PdfRenderer();
    expect(r.available()).toBe(false);
    await expect(r.render("<p>x</p>")).rejects.toMatchObject({ code: "raqib.pdf_unavailable", kind: "unavailable" });
  });
});
