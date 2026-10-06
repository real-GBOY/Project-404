import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { csvToXlsx, parseCsv, rowsToXlsx } from "./xlsx.js";

/** Read the stored entries back out of the ZIP, the way Excel would. */
function entries(zip: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let p = 0;
  while (zip.readUInt32LE(p) === 0x04034b50) {
    const method = zip.readUInt16LE(p + 8);
    const size = zip.readUInt32LE(p + 18);
    const nameLen = zip.readUInt16LE(p + 26);
    const name = zip.toString("utf8", p + 30, p + 30 + nameLen);
    const data = zip.subarray(p + 30 + nameLen, p + 30 + nameLen + size);
    out[name] = (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    p += 30 + nameLen + size;
  }
  return out;
}

describe("xlsx", () => {
  it("parses the CSV the exports write: BOM, quotes, commas, newlines in a field, CRLF", () => {
    const csv = `\uFEFFa,"b, c","say ""hi""","line1\nline2"\r\n1,2,,\r\n`;
    expect(parseCsv(csv)).toEqual([
      ["a", "b, c", 'say "hi"', "line1\nline2"],
      ["1", "2", "", ""],
    ]);
  });

  it("builds a workbook with the parts Excel needs, numbers as numbers, text as inline strings, Arabic intact", () => {
    const zip = rowsToXlsx(
      [
        ["Name", "Score"],
        ["مبنى أ", "92.5"],
        ['=HYPERLINK("http://x")', "007"],
      ],
      { sheet: "Analytics", rtl: true },
    );
    expect(zip.subarray(0, 2).toString()).toBe("PK");
    const f = entries(zip);
    expect(Object.keys(f).sort()).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/workbook.xml", "xl/worksheets/sheet1.xml"]);
    expect(f["xl/workbook.xml"]).toContain('name="Analytics"');
    const sheet = f["xl/worksheets/sheet1.xml"]!;
    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain('<c r="B2"><v>92.5</v></c>');
    expect(sheet).toContain("مبنى أ");
    expect(sheet).toContain('<c r="A3" t="inlineStr">'); // a formula-looking cell is text, never a formula
    expect(sheet).not.toContain("<f>");
    expect(sheet).toContain('<c r="B3" t="inlineStr"><is><t xml:space="preserve">007</t>'); // leading zeros are kept as text
  });

  it("escapes markup and drops control characters", () => {
    const sheet = entries(rowsToXlsx([["<b>&\u0001x"]]))["xl/worksheets/sheet1.xml"]!;
    expect(sheet).toContain("&lt;b&gt;&amp;x");
  });

  it("round-trips an export's CSV", () => {
    const csv = `\uFEFFProject,Compliance\r\nAl-Waha,91\r\n`;
    expect(entries(csvToXlsx(csv))["xl/worksheets/sheet1.xml"]).toContain("Al-Waha");
  });
});
