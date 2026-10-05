/** Bilingual master data (names, titles, cities). User-entered free text is never in this shape. */
export interface L10n {
  ar: string;
  en: string;
}

export const l10n = (ar: string, en: string): L10n => ({ ar, en });

/** Two-letter initials from a name, per language ("Khalid Al-Shehri" -> "KA"). */
export function initials(name: string): string {
  const parts = name.replace(/^(Eng\.|م\.|أ\.|د\.)\s*/u, "").split(/\s+/u).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return (first + second).toUpperCase();
}
