import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type { Browser } from "puppeteer-core";
import { AppError } from "@core/kernel/errors.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { readRaqibConfig, resolvePdfDriver, type PdfDriver } from "@raqib/config.js";
import { RenderQueue, type QueueStats } from "./render-queue.js";

const log = moduleLogger("raqib-pdf");
/** A browser left idle this long is closed; the next report starts a fresh one. */
const IDLE_CLOSE_MS = 60_000;
/** Cloudflare Browser Rendering: tries per report when it answers 429. */
const CLOUDFLARE_ATTEMPTS = 3;

/**
 * HTML → PDF, by one of two drivers (see `resolvePdfDriver`): headless Chromium on the server (puppeteer-core; the binary is set
 * by RAQIB_CHROMIUM_PATH), or Cloudflare Browser Rendering over its REST API, for hosts too small to run a browser.
 *
 * The Chromium driver works like this:
 *
 * One browser is kept warm between reports (starting Chromium is the slow part) and closed when idle; each report gets
 * its own page. Renders go through a bounded queue — `RAQIB_PDF_CONCURRENCY` at a time, `RAQIB_PDF_QUEUE_MAX` waiting,
 * the rest turned away with 429 — and each is abandoned after `RAQIB_PDF_TIMEOUT_MS`, so a burst of downloads or a stuck
 * page can never exhaust a small VPS. JavaScript is disabled in the page and the HTML is self-contained (no network).
 * The Chromium sandbox stays on unless the process runs as root or RAQIB_CHROMIUM_NO_SANDBOX=true (containers).
 */
@Injectable()
export class PdfRenderer implements OnApplicationShutdown {
  private browser: Promise<Browser> | undefined;
  private idle: NodeJS.Timeout | undefined;
  private queue: RenderQueue | undefined;

  driver(): PdfDriver | null {
    return resolvePdfDriver(readRaqibConfig());
  }

  available(): boolean {
    return this.driver() !== null;
  }

  stats(): QueueStats & { available: boolean; driver: PdfDriver | null } {
    return { ...this.q().stats(), available: this.available(), driver: this.driver() };
  }

  private q(): RenderQueue {
    if (!this.queue) {
      const c = readRaqibConfig();
      // the hosted service is the strict one: render one report at a time
      const concurrency = resolvePdfDriver(c) === "cloudflare" ? 1 : c.pdfConcurrency;
      this.queue = new RenderQueue({ concurrency, maxQueue: c.pdfQueueMax, timeoutMs: c.pdfTimeoutMs });
    }
    return this.queue;
  }

  private async launch(): Promise<Browser> {
    const cfg = readRaqibConfig();
    const puppeteer = await import("puppeteer-core");
    const root = typeof process.getuid === "function" && process.getuid() === 0;
    const args = ["--disable-gpu", "--disable-dev-shm-usage", ...(root || cfg.chromiumNoSandbox ? ["--no-sandbox"] : [])];
    const b = await puppeteer.launch({ executablePath: cfg.chromiumPath, headless: true, args });
    b.on("disconnected", () => {
      if (this.browser) this.browser = undefined;
    });
    return b;
  }

  private async getBrowser(): Promise<Browser> {
    this.browser ??= this.launch().catch((err) => {
      this.browser = undefined;
      throw err;
    });
    return this.browser;
  }

  private armIdle(): void {
    if (this.idle) clearTimeout(this.idle);
    this.idle = setTimeout(() => void this.closeBrowser(), IDLE_CLOSE_MS);
    this.idle.unref?.();
  }

  private async closeBrowser(): Promise<void> {
    const b = this.browser;
    this.browser = undefined;
    if (b) await (await b).close().catch((err) => log.warn({ err }, "closing chromium failed"));
  }

  async render(html: string): Promise<Buffer> {
    const driver = this.driver();
    if (!driver) {
      throw new AppError({ code: "raqib.pdf_unavailable", message: "PDF generation is not configured on this server.", kind: "unavailable" });
    }
    if (driver === "cloudflare") return this.q().run(() => this.renderWithCloudflare(html));
    return this.q().run(
      async () => {
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        try {
          await page.setJavaScriptEnabled(false);
          await page.setContent(html, { waitUntil: "load" });
          return Buffer.from(await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
        } finally {
          await page.close().catch(() => undefined);
          this.armIdle();
        }
      },
      // a render that overran may have wedged the browser: drop it so the next report starts clean
      () => void this.closeBrowser(),
    );
  }

  /**
   * One REST call: the self-contained report HTML goes up, the PDF bytes come back (same page options as the Chromium driver).
   * Cloudflare answers a burst with 429 (its free plan is strict), so a refusal is retried a couple of times after the pause it asks
   * for (`Retry-After`), all inside the render timeout; if it keeps refusing the person is told to try again in a moment.
   */
  private async renderWithCloudflare(html: string): Promise<Buffer> {
    const cfg = readRaqibConfig();
    const deadline = Date.now() + cfg.pdfTimeoutMs;
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfg.cfAccountId)}/browser-rendering/pdf`;
    const body = JSON.stringify({
      html,
      setJavaScriptEnabled: false,
      gotoOptions: { waitUntil: "load" },
      pdfOptions: { format: "a4", printBackground: true, preferCSSPageSize: true },
    });
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${cfg.cfApiToken}`, "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
      });
      if (res.status === 429) {
        const asked = Number(res.headers.get("retry-after"));
        const pause = Math.min(8_000, Math.max(200, Number.isFinite(asked) && res.headers.has("retry-after") ? asked * 1000 : 1_500 * attempt));
        if (attempt < CLOUDFLARE_ATTEMPTS && Date.now() + pause < deadline) {
          await new Promise((r) => setTimeout(r, pause));
          continue;
        }
        throw new AppError({ code: "raqib.pdf_busy", message: "The PDF service is busy. Try again in a moment.", kind: "rate_limited" });
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (!res.ok || bytes.subarray(0, 4).toString("latin1") !== "%PDF") {
        log.error({ status: res.status, body: bytes.subarray(0, 300).toString("utf8") }, "cloudflare browser rendering did not return a pdf");
        throw new AppError({ code: "raqib.pdf_failed", message: "The PDF could not be generated.", kind: "unavailable" });
      }
      return bytes;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.idle) clearTimeout(this.idle);
    await this.closeBrowser();
  }
}
