import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type { Browser } from "puppeteer-core";
import { AppError } from "@core/kernel/errors.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { readRaqibConfig } from "@raqib/config.js";
import { RenderQueue, type QueueStats } from "./render-queue.js";

const log = moduleLogger("raqib-pdf");
/** A browser left idle this long is closed; the next report starts a fresh one. */
const IDLE_CLOSE_MS = 60_000;

/**
 * HTML → PDF through headless Chromium (puppeteer-core; the browser binary is the server's, set by RAQIB_CHROMIUM_PATH).
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

  available(): boolean {
    return readRaqibConfig().chromiumPath.length > 0;
  }

  stats(): QueueStats & { available: boolean } {
    return { ...this.q().stats(), available: this.available() };
  }

  private q(): RenderQueue {
    if (!this.queue) {
      const c = readRaqibConfig();
      this.queue = new RenderQueue({ concurrency: c.pdfConcurrency, maxQueue: c.pdfQueueMax, timeoutMs: c.pdfTimeoutMs });
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
    if (!this.available()) {
      throw new AppError({ code: "raqib.pdf_unavailable", message: "PDF generation is not configured on this server.", kind: "internal" });
    }
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

  async onApplicationShutdown(): Promise<void> {
    if (this.idle) clearTimeout(this.idle);
    await this.closeBrowser();
  }
}
