import { describe, expect, it } from "vitest";
import { directionOf, negotiateLocale } from "../domain/locale.js";
import { resolveTranslatable, translatable } from "../domain/translatable.js";
import { formatCurrency, formatDate, formatNumber } from "../formatters/formatters.js";
import { t } from "../i18n/catalog.js";

describe("locale", () => {
  it("knows Arabic is RTL and English is LTR", () => {
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("ar-EG")).toBe("rtl");
    expect(directionOf("en")).toBe("ltr");
  });

  it("negotiates the best supported locale, Arabic-first fallback", () => {
    expect(negotiateLocale(["fr", "en-US"], ["ar", "en"], "ar")).toBe("en");
    expect(negotiateLocale([null, undefined], ["ar", "en"], "ar")).toBe("ar");
    expect(negotiateLocale(["de"], ["ar", "en"], "ar")).toBe("ar");
  });
});

describe("translatable", () => {
  it("resolves per language and falls back to Arabic", () => {
    const v = translatable("مرحبا", "Hello");
    expect(resolveTranslatable(v, "ar")).toBe("مرحبا");
    expect(resolveTranslatable(v, "en")).toBe("Hello");
    expect(resolveTranslatable(v, "fr")).toBe("مرحبا");
  });
});

describe("AR-EG formatting", () => {
  it("formats numbers and currency for Egypt", () => {
    expect(formatNumber(1234.5, "en")).toBe("1,234.5");
    expect(formatCurrency(1000, "en")).toContain("EGP");
    // Arabic locale uses Eastern Arabic digits by default
    expect(formatNumber(1234, "ar")).toMatch(/[٠-٩]/);
  });

  it("formats a date without throwing for either locale", () => {
    const d = new Date("2026-08-29T10:00:00Z");
    expect(formatDate(d, "en")).toBeTruthy();
    expect(formatDate(d, "ar")).toBeTruthy();
  });
});

describe("i18n catalog", () => {
  it("translates known keys and echoes unknown ones", () => {
    expect(t("common.ok", "en")).toBe("OK");
    expect(t("common.ok", "ar")).toBe("تم");
    expect(t("does.not.exist", "en")).toBe("does.not.exist");
  });

  it("interpolates params", () => {
    expect(t("notification.welcome_title", "en", { app: "AURIC" })).toBe("Welcome to AURIC");
  });
});
