import { Injectable } from "@nestjs/common";
import { AppError } from "@core/kernel/errors.js";
import { readRaqibConfig } from "@raqib/config.js";

/**
 * HTML → PDF through headless Chromium (puppeteer-core; the browser itself is the server's, configured by
 * RAQIB_CHROMIUM_PATH). One short-lived browser per render keeps memory predictable on a small VPS; reports are
 * infrequent. Chromium is started without network access to anything: the HTML is self-contained.
 */
@Injectable()
export class PdfRenderer {
  available(): boolean {
    return readRaqibConfig().chromiumPath.length > 0;
  }

  async render(html: string): Promise<Buffer> {
    const executablePath = readRaqibConfig().chromiumPath;
    if (!executablePath) {
      throw new AppError({ code: "raqib.pdf_unavailable", message: "PDF generation is not configured on this server.", kind: "internal" });
    }
    const puppeteer = await import("puppeteer-core");
    const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
    try {
      const page = await browser.newPage();
      await page.setJavaScriptEnabled(false);
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
