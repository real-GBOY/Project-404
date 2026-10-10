/**
 * CSV for exports that people open in Excel or Google Sheets.
 *
 * - A UTF-8 byte-order mark first, so Excel reads Arabic and accented names correctly.
 * - CRLF line ends and RFC 4180 quoting.
 * - Formula-injection guard: a cell that starts with `=`, `+`, `-`, `@`, tab or carriage return would run as a formula in a spreadsheet,
 *   and these lists hold text typed by strangers (names, notes). Such a cell gets a leading apostrophe, which spreadsheets show as plain text.
 */
const DANGEROUS_START = /^[=+\-@\t\r]/;
const BOM = String.fromCharCode(0xfeff);
const EOL = "\r\n";

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (DANGEROUS_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return BOM + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join(EOL) + EOL;
}

/** File name for a download: ASCII, no spaces, dated. */
export function csvFileName(prefix: string, now: Date): string {
  return `${prefix}-${now.toISOString().slice(0, 10)}.csv`;
}
