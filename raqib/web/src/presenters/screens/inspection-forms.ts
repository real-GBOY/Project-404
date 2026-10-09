import type { Inspection } from "@/api/types";
import { ApiError } from "@/services/http";
import { C } from "@/styles/colors";
import type { Ctx } from "../context";

/**
 * A visit may require several forms. This is the form switcher of the inspection workspace: which forms there are, the order
 * of the steps of the one on screen, moving to another form (starting it first when it has not been started), and whether the
 * other forms are complete enough for the visit to be submitted.
 */
export function formSwitcher(c: Ctx, insp: Inspection, vid: string) {
  const { i, set, data } = c;
  const forms = data.visitForms ?? [];
  const multi = forms.length > 1;
  const hasGuardStep = insp.guardCriteria.length > 0;
  // section steps, then the guard evaluation (first form only), then review and submit
  const order = [...insp.sections.map((_, idx) => idx), ...(hasGuardStep ? [5] : []), 6];
  const switchTo = (formId: string, started: boolean) => {
    if (formId === insp.formId) return;
    if (!started && insp.editable) {
      void c.actions
        .startInspection(vid, formId)
        .then(() => set({ formId, step: 0, decl: false }))
        .catch((err: unknown) =>
          c.toast(err instanceof ApiError ? err.message : i.S("actionFailed")),
        );
      return;
    }
    if (started) set({ formId, step: 0 });
  };
  const otherForms = forms.filter((f) => f.formId !== insp.formId);
  const othersReady = otherForms.every((f) => f.started && f.blocking === 0);
  const formRows = multi
    ? forms.map((f) => {
        const current = f.formId === insp.formId;
        const done = f.started && f.blocking === 0;
        return {
          label: `${f.code}${f.issueNo ? ` · ${f.issueNo}` : ""}`,
          meta: f.started ? `${f.answered}/${f.total}` : i.S("notStarted"),
          go: () => switchTo(f.formId, f.started),
          bg: current ? C.brand.tint : "transparent",
          fg: current ? C.brand.primaryDark : C.text.ink,
          mark: done ? C.status.success.fg : C.border.input,
          markTxt: done ? "✓" : "▣",
          cbg: current ? C.brand.primary : C.surface.white,
          cfg: current ? C.surface.white : C.text.body,
          cbd: current ? C.brand.primary : C.border.input,
        };
      })
    : [];
  return { forms, multi, hasGuardStep, order, switchTo, otherForms, othersReady, formRows };
}
