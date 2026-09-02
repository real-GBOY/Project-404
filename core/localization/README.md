# `core/localization` — locale, direction, formatting

## 1. What it is

Arabic-first localization primitives (Plan §7.10 / §12A): the supported-locale
list, text direction resolution (RTL for `ar`), a small translation catalog for
Core's own strings, and `ar-EG` / `en-EG` formatters for dates, numbers, and
currency in `Africa/Cairo`.

## 2. Why it exists

AURIC targets an Arabic-first market. Locale, direction, and Egypt-correct
formatting are platform concerns — every product and both clients must agree on
them, and RTL is expensive to retrofit.

## 3. What problem it solves

- One source of truth for "which locales exist", "is this locale RTL", and "how
  does money/date format in Egypt".
- Core-owned strings (error messages, notification templates) rendered in the
  right language.
- A formatter contract the frontend mirrors (`mizan/web/src/lib/format` follows the
  same `ar-EG` / `Africa/Cairo` rules).

## 4. Responsibilities

- `domain/locale.ts` — `SUPPORTED_LOCALES`, `DEFAULT_LOCALE = "ar"`, `dirFor()`.
- `domain/translatable.ts` — the shape for AR/EN content pairs stored on
  entities.
- `formatters/formatters.ts` — `formatDate`, `formatDateTime`, `formatNumber`,
  `formatMoney`, `formatMoneyList` (never sums across currencies),
  `formatPercent` — locale-aware, `Africa/Cairo`, EGP default.
- `i18n/catalog.ts` — Core's own string catalog.

## 5. What it owns

The supported-locale set, the direction rule, the Egypt formatting conventions,
and Core's string catalog.

## 6. What it explicitly does NOT own

- **Product copy.** Mizan's strings (`mizan/web/src/lib/i18n/resources/*.json`,
  backend domain messages) are the product's, not Core's.
- **Translation of user-entered data** — client names, matter titles, notes are
  shown as entered, never machine-translated.
- A translation-management workflow / CMS.
- Per-user timezone — the app is `Africa/Cairo`; a real requirement would add it.

## 7. Public surface

- `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `dirFor(locale)`.
- The formatter functions.
- `Translatable<T>` type.

## 8. How to use

Backend, formatting a value for a response:

```ts
import { formatMoneyList } from "@auric/core/localization";
outstanding: formatMoneyList([{ currency: "EGP", amount: "4360000" }, { currency: "AED", amount: "24000" }]);
// → ["EGP 4,360,000", "AED 24,000"]   — two lines, never one sum
```

Frontend consumes the *same rules* via `mizan/web/src/lib/format` (it re-implements,
not imports — `mizan/web/` takes no backend code).

## 9. Dependencies & direction

Depends on nothing (uses `Intl`). Consumed by `core/notifications` (template
rendering) and by any code that formats a value. No feature module depends on
localization's internals.

## 10. Invariants

1. `ar` is the default; RTL is first-class, not a retrofit.
2. Money is a `{ currency, amount }` pair and is **never summed across
   currencies** (no FX, no "dominant currency" — matches Mizan decision #8).
3. Formatting uses `Africa/Cairo` and `ar-EG` / `en-EG`.
4. Core strings live in `i18n/catalog.ts`; product strings do not.

## 11. Example — direction

```ts
dirFor("ar") // "rtl"   → <html dir="rtl">
dirFor("en") // "ltr"
```

## 12. Testing expectations

`core/localization/tests/`: `dirFor` for each locale; `formatMoney` rounding and
currency placement in both locales; `formatMoneyList` returns one line per
currency; date formatting respects `Africa/Cairo`.

## 13. When NOT to extend it

- To hold product translations — those belong to the product.
- To add currency conversion — the whole system is deliberately FX-free.
- To add per-user timezones or a third locale without a real requirement.
