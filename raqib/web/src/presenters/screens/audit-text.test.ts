import { describe, expect, it } from "vitest";
import { createI18n } from "@/i18n/i18n";
import { actionLabel, changeText, entityLabel } from "./audit-text";

describe("reading the audit log", () => {
  it("turns action codes into words and record types into names in either language", () => {
    expect(actionLabel("raqib.evidence.attached")).toBe("Evidence attached");
    expect(actionLabel("user.logged_in")).toBe("User logged in");
    expect(entityLabel(createI18n("en"), "raqib_action")).toBe("Corrective action");
    expect(entityLabel(createI18n("ar"), "raqib_action")).toBe("إجراء تصحيحي");
    expect(entityLabel(createI18n("en"), "something_new")).toBe("something_new"); // an unknown type is shown as sent
  });

  it("shows a change as field: value pairs, without the tenant id, instead of a JSON blob", () => {
    expect(changeText({ organizationId: "org_1", status: "closed", dueDate: "2026-10-12" })).toBe(
      "status: closed · due date: 2026-10-12",
    );
    expect(changeText(null)).toBe("");
    expect(changeText({ kind: "photo", meta: { a: 1 } })).toBe('kind: photo · meta: {"a":1}');
    expect(changeText({ text: "x".repeat(400) }, 50)).toHaveLength(50);
  });
});
