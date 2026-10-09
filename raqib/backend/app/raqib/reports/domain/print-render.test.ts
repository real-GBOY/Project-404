import { describe, expect, it } from "vitest";
import { renderBlankFormHtml } from "../../forms/domain/blank-form-html.js";
import { renderReportHtml } from "./report-html.js";
import type { FormPart, ReportSnapshot } from "./report-snapshot.js";

const L = (ar: string, en: string) => ({ ar, en });
const part = (code: string, issueNo: string): FormPart => ({
  issueNo,
  form: { code, version: "1.0", name: L("نموذج", `Form ${code}`) },
  round: 1,
  score: { pct: 80, compliant: 1, nonCompliant: 1, na: 0, evidence: 0 },
  scoring: { policy: "deduction_v1", version: 2, deductions: [{ num: "1.2", text: L("ب", "<script>alert(1)</script>"), severity: "high", amount: 10 }] },
  sections: [
    {
      title: L("قسم", "Section"),
      items: [
        { num: "1.1", text: L("أ", "A"), weight: 1, answer: "c", note: "", evidence: [] },
        { num: "1.2", text: L("ب", "B"), weight: 1, answer: "n", note: "x".repeat(400), evidence: [] },
      ],
    },
  ],
  violations: [],
});
const lead = part("FRM-A", "INS-26-0001");
const snapshot: ReportSnapshot = {
  version: 1,
  ref: "RPT-26-0001",
  visitRef: "VIS-26-0001",
  issuedAt: "2026-10-09T08:00:00.000Z",
  project: { code: "P", name: L("مشروع", "Project") },
  site: L("موقع", "Site"),
  area: "free text <b>area</b>",
  type: "routine",
  shift: "morning",
  date: "2026-10-08",
  time: "09:30",
  inspector: L("مفتش", "Inspector"),
  issueNo: lead.issueNo,
  form: lead.form,
  round: 1,
  score: lead.score,
  scoring: lead.scoring,
  sections: lead.sections,
  violations: [],
  guards: [],
  decisions: [],
  approvedBy: { name: L("معتمد", "Approver"), title: L("مدير", "Director") },
};

describe("printable report", () => {
  it("is an A4 document in the requested direction with page numbers and repeating table headings", () => {
    const en = renderReportHtml(snapshot, "en", new Map());
    expect(en).toContain('dir="ltr"');
    expect(en).toContain("size: A4");
    expect(en).toContain("counter(page)");
    expect(en).toContain("<thead>");
    expect(en).toContain("thead { display: table-header-group; }");
    expect(renderReportHtml(snapshot, "ar", new Map())).toContain('dir="rtl"');
  });

  it("escapes everything that came from a person", () => {
    const html = renderReportHtml(snapshot, "en", new Map());
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("free text &lt;b&gt;area&lt;/b&gt;");
  });

  it("keeps long unbroken text inside the page", () => {
    const html = renderReportHtml(snapshot, "en", new Map());
    expect(html).toContain("overflow-wrap: anywhere");
    expect(html).toContain("table-layout: fixed");
  });

  it("starts every form of a multi-form visit on its own page, each with its issue number, and lists them first", () => {
    const html = renderReportHtml({ ...snapshot, overallPct: 85, extraForms: [part("FRM-B", "INS-26-0002")] }, "en", new Map());
    expect(html).toContain('<body class="multi">');
    expect(html).toContain(".multi .form-part { break-before: page; }");
    expect(html.match(/<section class="form-part">/g)).toHaveLength(2);
    for (const needle of ["INS-26-0001", "INS-26-0002", "FRM-B", "85%"]) expect(html).toContain(needle);
    expect(renderReportHtml(snapshot, "en", new Map())).toContain('<body class="">');
  });

  it("shows the deductions and the rule version a form was scored under", () => {
    const html = renderReportHtml(snapshot, "en", new Map());
    expect(html).toContain("Deductions");
    expect(html).toContain("v2");
    expect(html).toContain("−10");
  });

  it("shows the configured shift name, and the key for older reports", () => {
    expect(renderReportHtml({ ...snapshot, shiftName: L("نهارية", "Day shift") }, "en", new Map())).toContain("Day shift");
    expect(renderReportHtml(snapshot, "en", new Map())).toContain("Morning"); // a built-in key reads as its name
    expect(renderReportHtml({ ...snapshot, shift: "custom_x" }, "en", new Map())).toContain("custom_x");
  });
});

describe("blank form", () => {
  const sections = [
    {
      key: "s1",
      title: L("قسم", "Section"),
      items: [
        { key: "a", text: L("أ", "Gate locked"), weight: 1, type: "cnx" as const, required: true, na: true, evidenceOnNc: false },
        { key: "b", text: L("ب", "Count <b>units</b>"), weight: 1, type: "number" as const, required: true, na: false, evidenceOnNc: false },
      ],
    },
  ];

  it("prints the form name, number and version, every item in order, answer boxes and signature lines", () => {
    const html = renderBlankFormHtml({ code: "FRM-A", name: L("نموذج", "My form"), version: "2.1" }, sections, "en");
    for (const needle of ["My form", "FRM-A", "2.1", "Gate locked", 'class="box"', "Signature", "thead"]) expect(html).toContain(needle);
    expect(html.indexOf("Gate locked")).toBeLessThan(html.indexOf("units"));
    expect(html).toContain("Count &lt;b&gt;units&lt;/b&gt;");
    expect(renderBlankFormHtml({ code: "FRM-A", name: L("نموذج", "My form"), version: "2.1" }, sections, "ar")).toContain('dir="rtl"');
  });
});
