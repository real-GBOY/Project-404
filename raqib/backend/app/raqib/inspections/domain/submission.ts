import type { Answer } from "./scoring.js";

/**
 * What stops an inspection from being submitted. Pure: the service gathers the facts, this decides. The same
 * list is shown to the inspector (so they can fix it) and re-checked by the backend on submit (so it cannot be
 * bypassed).
 */
export type IssueCode = "unanswered" | "note_required" | "evidence_required" | "evidence_pending" | "flag_untouched" | "guard_incomplete";
export interface Issue {
  code: IssueCode;
  /** Section.item number ("2.3"), or the guard's name for `guard_incomplete`. */
  at: string;
  /** The inspection step to open: section index, or 5 for guards. */
  step: number;
}

export interface ItemFacts {
  num: string;
  step: number;
  required: boolean;
  evidenceOnNc: boolean;
  answer: Answer;
  note: string;
  storedEvidence: number;
  pendingEvidence: number;
  flagged: boolean;
  /** Edited since the reviewer flagged it (in a later submission round). */
  touchedSinceFlag: boolean;
}

export function submissionIssues(items: ItemFacts[], guards: Array<{ name: string; done: boolean }>, rules: { ncNote: boolean; ncEvidence: boolean }): Issue[] {
  const out: Issue[] = [];
  for (const it of items) {
    if (!it.answer) {
      if (it.required) out.push({ code: "unanswered", at: it.num, step: it.step });
    } else if (it.answer === "n") {
      if (rules.ncNote && !it.note.trim()) out.push({ code: "note_required", at: it.num, step: it.step });
      if (rules.ncEvidence && it.evidenceOnNc && it.storedEvidence === 0) out.push({ code: "evidence_required", at: it.num, step: it.step });
    }
    if (it.pendingEvidence > 0) out.push({ code: "evidence_pending", at: it.num, step: it.step });
    if (it.flagged && !it.touchedSinceFlag) out.push({ code: "flag_untouched", at: it.num, step: it.step });
  }
  for (const g of guards) if (!g.done) out.push({ code: "guard_incomplete", at: g.name, step: 5 });
  return out;
}
