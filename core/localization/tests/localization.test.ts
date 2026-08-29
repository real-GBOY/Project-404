import { describe, expect, it } from "vitest";
import { directionOf, isSupported, languageOf, negotiateLocale } from "../domain/locale.js";
import { isTranslatable, resolveTranslatable, translatable } from "../domain/translatable.js";
import { formatCurrency, formatDate, formatNumber } from "../formatters/formatters.js";
import { bundleFor, t } from "../i18n/catalog.js";

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

  it("negotiation matches on the language subtag and returns the supported entry", () => {
    expect(negotiateLocale(["ar-EG"], ["ar", "en"], "en")).toBe("ar");
    // earlier candidate wins over a later one
    expect(negotiateLocale(["en", "ar"], ["ar", "en"], "ar")).toBe("en");
  });

  it("languageOf takes the primary subtag", () => {
    expect(languageOf("ar-EG")).toBe("ar");
    expect(languageOf("EN_us")).toBe("en");
    expect(languageOf("fr")).toBe("fr");
  });

  it("isSupported compares by language, ignoring region", () => {
    expect(isSupported("ar-EG", ["ar", "en"])).toBe(true);
    expect(isSupported("de", ["ar", "en"])).toBe(false);
  });
});

describe("translatable", () => {
  it("resolves per language and falls back to Arabic", () => {
    const v = translatable("مرحبا", "Hello");
    expect(resolveTranslatable(v, "ar")).toBe("مرحبا");
    expect(resolveTranslatable(v, "en")).toBe("Hello");
    expect(resolveTranslatable(v, "fr")).toBe("مرحبا");
  });

  it("uses an extra locale when one is provided", () => {
    const v = translatable("مرحبا", "Hello", { fr: "Bonjour" });
    expect(resolveTranslatable(v, "fr-FR")).toBe("Bonjour");
  });

  it("isTranslatable recognises the bilingual shape", () => {
    expect(isTranslatable({ ar: "أ", en: "a" })).toBe(true);
    expect(isTranslatable({ ar: "أ" })).toBe(false);
    expect(isTranslatable("plain string")).toBe(false);
    expect(isTranslatable(null)).toBe(false);
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

  it("leaves an unfilled placeholder visible rather than blanking it", () => {
    expect(t("notification.welcome_title", "en")).toBe("Welcome to {{app}}");
  });

  it("resolves via the Arabic bundle for an unsupported locale", () => {
    expect(t("common.ok", "de")).toBe("تم");
  });

  it("bundleFor returns the language bundle, defaulting to Arabic", () => {
    expect(bundleFor("en").common).toMatchObject({ ok: "OK" });
    expect(bundleFor("de")).toBe(bundleFor("ar"));
  });
});
