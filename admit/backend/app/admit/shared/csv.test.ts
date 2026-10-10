import { describe, expect, it } from "vitest";
import { csvCell, csvFileName, toCsv } from "./csv.js";

describe("csv", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell(null)).toBe("");
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell(new Date("2026-10-10T12:00:00.000Z"))).toBe("2026-10-10T12:00:00.000Z");
  });

  it("defuses spreadsheet formulas typed by strangers", () => {
    for (const evil of ['=HYPERLINK("http://x","y")', "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) {
      expect(csvCell(evil).replace(/^"/, "").startsWith("'")).toBe(true);
    }
    expect(csvCell("-")).toBe("'-");
    expect(csvCell("a=b")).toBe("a=b"); // only a leading character matters
  });

  it("starts with a BOM and uses CRLF so Excel reads Arabic names", () => {
    const out = toCsv(
      ["Name", "City"],
      [
        ["منى", "القاهرة"],
        ["Ali", "Cairo, EG"],
      ],
    );
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toBe('\uFEFFName,City\r\nمنى,القاهرة\r\nAli,"Cairo, EG"\r\n');
  });

  it("names the file with the date", () => {
    expect(csvFileName("admit-bookings", new Date("2026-10-10T23:59:00Z"))).toBe("admit-bookings-2026-10-10.csv");
  });
});
