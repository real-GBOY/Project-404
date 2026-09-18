import type { ScopeGuardConfig } from "@core/index.js";

/**
 * Atlas's own scope vocabulary for Core's generic `ScopeGuard`
 * (core/assistant/application/scope-guard.ts) — bound via `SCOPE_GUARD_CONFIG`
 * in assistant.module.ts. The heuristic/classifier/fail-open *decision order*
 * lives in Core; only this domain content is Atlas's.
 *
 * Ported from `mizan/backend/app/lawfirm/assistant/scope-vocabulary.ts`.
 */

// Obviously in scope — real-estate entities, Atlas how-to, or a question about
// the assistant itself. Skips the classifier call.
const IN_SCOPE =
  /\b(project|projects|building|buildings|unit|units|floor|lead|leads|customer|customers|pipeline|deal|deals|reservation|reservations|contract|contracts|payment plan|installment|installments|collection|collections|overdue|outstanding|revenue|commission|commissions|task|tasks|approval|approvals|workflow|inventory|sell.?through|velocity|dashboard|analytics|agent|sales|portfolio|atlas|conversation|conversations|message|messages|chat|chats|follow.?up|follow.?ups|insight|insights)\b/i;
const IN_SCOPE_AR =
  /(مشروع|مشاريع|مبنى|مباني|وحدة|وحدات|طابق|عميل محتمل|عملاء|صفقة|صفقات|حجز|حجوزات|عقد|عقود|خطة سداد|قسط|أقساط|تحصيل|تحصيلات|متأخر|مستحق|إيراد|عمولة|مهمة|مهام|موافقة|موافقات|سير عمل|مخزون|لوحة|تحليلات|وكيل|مبيعات|أطلس|محادثة|محادثات|رسالة|رسائل|متابعة)/;
const META =
  /\b(what can you do|who are you|what are you|how do (i|you)|how to|help me (with|use)|your (capabilities|features)|hello|hi there|hey|thanks|thank you)\b/i;
const META_AR = /(ماذا تفعل|من أنت|كيف (أ|ا)ستخدم|كيف يمكنني|ساعدني|مرحبا|شكرا|أهلا)/;

// Obviously out of scope — general knowledge, coding, content generation, etc.
const OUT_OF_SCOPE =
  /\b(write (me |a |some )?(code|a program|a script|a poem|an essay|a story|a song)|python|javascript|typescript|c\+\+|sql query|regex|recipe|weather|stock price|bitcoin|crypto|who (is|was) the|capital of|translate this|tell me a joke|current events|news|football|movie|celebrity)\b/i;

const CLASSIFIER_PROMPT = `You route requests for "Atlas Copilot", an assistant that ONLY helps with one real-estate developer's portfolio data and workflows: projects, buildings, units and inventory, leads and the sales pipeline, customers, reservations, contracts, payment plans and installments, collections/outstanding balances, commissions, tasks, the team's conversations about leads and the AI insights derived from them, and how to use the Atlas app.

Classify the user's message:
- IN_SCOPE — asks about the portfolio's projects/units/leads/customers/reservations/contracts/collections/tasks/analytics, or how to do something in Atlas, or is a short follow-up to such a topic, or a greeting/thanks.
- OUT_OF_SCOPE — general knowledge, current events, math or coding help, writing unrelated content (poems, essays, code), translation, real-estate market research not tied to this portfolio's own data, personal chit-chat, or anything a real-estate operations assistant would not handle.

Reply with exactly one token: IN_SCOPE or OUT_OF_SCOPE.`;

export const atlasScopeVocabulary: ScopeGuardConfig = {
  inScopePatterns: [IN_SCOPE, IN_SCOPE_AR],
  metaPatterns: [META, META_AR],
  outOfScopePatterns: [OUT_OF_SCOPE],
  classifierPrompt: CLASSIFIER_PROMPT,
  outOfScopeReply: (locale) =>
    locale === "ar"
      ? "أنا مساعد أطلس، وأساعد فقط في أعمال شركتك العقارية داخل أطلس: المشاريع والوحدات والعملاء والمبيعات والحجوزات والعقود والتحصيلات والمهام، وكيفية استخدام النظام. لا أستطيع المساعدة في هذا الطلب."
      : "I'm Atlas Copilot — I only help with your real estate business inside Atlas: projects, units, leads, customers, reservations, contracts, collections, tasks and analytics, plus how to use the app. I can't help with that request.",
};
