import type { ScopeGuardConfig } from "@core/index.js";

/**
 * Mizan's own scope vocabulary for Core's generic `ScopeGuard`
 * (core/assistant/application/scope-guard.ts) — bound via `SCOPE_GUARD_CONFIG`
 * in assistant.module.ts. The heuristic/classifier/fail-open *decision order*
 * lives in Core; only this domain content is Mizan's.
 */

// Obviously in scope — firm entities, Mizan how-to, or a question about the
// assistant itself. Skips the classifier call.
const IN_SCOPE =
  /\b(matter|matters|case|cases|client|clients|hearing|hearings|court|task|tasks|deadline|deadlines|calendar|schedule|invoice|invoices|payment|payments|expense|expenses|bill|billing|document|documents|filing|appeal|adjourn|adjournment|litigation|lawyer|paralegal|dashboard|reminder|overdue|assignee|practice area|mizan)\b/i;
const IN_SCOPE_AR =
  /(قضاي|قضية|جلسة|جلسات|محكمة|عميل|عملاء|مهمة|مهام|موعد|مواعيد|تقويم|فاتورة|فواتير|دفعة|مدفوعات|مصروف|مصروفات|فوترة|مستند|مستندات|استئناف|تأجيل|متأخر|لوحة|ميزان)/;
const META =
  /\b(what can you do|who are you|what are you|how do (i|you)|how to|help me (with|use)|your (capabilities|features)|hello|hi there|hey|thanks|thank you)\b/i;
const META_AR = /(ماذا تفعل|من أنت|كيف (أ|ا)ستخدم|كيف يمكنني|ساعدني|مرحبا|شكرا|أهلا)/;

// Obviously out of scope — general knowledge, coding, content generation, etc.
const OUT_OF_SCOPE =
  /\b(write (me |a |some )?(code|a program|a script|a poem|an essay|a story|a song)|python|javascript|typescript|c\+\+|sql query|regex|recipe|weather|stock price|bitcoin|crypto|who (is|was) the|capital of|translate this|tell me a joke|current events|news|football|movie|celebrity)\b/i;

const CLASSIFIER_PROMPT = `You route requests for "Mizan Copilot", an assistant that ONLY helps with one law firm's practice-management data and workflows: matters/cases, clients, hearings, court dates, tasks, deadlines, the calendar, document metadata, invoices, payments, expenses, and how to use the Mizan app.

Classify the user's message:
- IN_SCOPE — asks about the firm's matters/clients/hearings/tasks/deadlines/billing/calendar/documents, or how to do something in Mizan, or is a short follow-up to such a topic, or a greeting/thanks.
- OUT_OF_SCOPE — general knowledge, current events, math or coding help, writing unrelated content (poems, essays, code), translation, legal research not tied to this firm's own data, personal chit-chat, or anything a practice-management assistant would not handle.

Reply with exactly one token: IN_SCOPE or OUT_OF_SCOPE.`;

export const mizanScopeVocabulary: ScopeGuardConfig = {
  inScopePatterns: [IN_SCOPE, IN_SCOPE_AR],
  metaPatterns: [META, META_AR],
  outOfScopePatterns: [OUT_OF_SCOPE],
  classifierPrompt: CLASSIFIER_PROMPT,
  outOfScopeReply: (locale) =>
    locale === "ar"
      ? "أنا مساعد ميزان، وأساعد فقط في أعمال مكتبك داخل ميزان: القضايا والعملاء والجلسات والمهام والمواعيد والتقويم والمستندات والفوترة، وكيفية استخدام النظام. لا أستطيع المساعدة في هذا الطلب."
      : "I'm Mizan Copilot — I only help with your firm's work inside Mizan: matters, clients, hearings, tasks, deadlines, the calendar, documents and billing, plus how to use the app. I can't help with that request.",
};
