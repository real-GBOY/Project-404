import { Inject, Injectable } from "@nestjs/common";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { AI_CLIENT, type AiClient } from "./ai/ai-client.js";
import { ASSISTANT_CONFIG, type AssistantConfig } from "./assistant-config.js";

const log = moduleLogger("assistant-scope");

export interface ScopeDecision {
  inScope: boolean;
  /** How the decision was reached — for logging only. */
  via:
    "disabled" | "in_heuristic" | "out_heuristic" | "followup" | "classifier" | "classifier_error";
}

/** The fixed refusal, per locale. Kept identical every time so it's unmistakable. */
export function outOfScopeReply(locale: string): string {
  return locale === "ar"
    ? "أنا مساعد أطلس، وأساعد فقط في أعمال شركتك العقارية داخل أطلس: المشاريع والوحدات والعملاء والمبيعات والحجوزات والعقود والتحصيلات والمهام، وكيفية استخدام النظام. لا أستطيع المساعدة في هذا الطلب."
    : "I'm Atlas Copilot — I only help with your real estate business inside Atlas: projects, units, leads, customers, reservations, contracts, collections, tasks and analytics, plus how to use the app. I can't help with that request.";
}

// Obviously in scope — real-estate entities, Atlas how-to, or a question about
// the assistant itself. Skips the classifier call.
const IN_SCOPE =
  /\b(project|projects|building|buildings|unit|units|floor|lead|leads|customer|customers|pipeline|deal|deals|reservation|reservations|contract|contracts|payment plan|installment|installments|collection|collections|overdue|outstanding|revenue|commission|commissions|task|tasks|approval|approvals|workflow|inventory|sell.?through|velocity|dashboard|analytics|agent|sales|portfolio|atlas)\b/i;
const IN_SCOPE_AR =
  /(مشروع|مشاريع|مبنى|مباني|وحدة|وحدات|طابق|عميل محتمل|عملاء|صفقة|صفقات|حجز|حجوزات|عقد|عقود|خطة سداد|قسط|أقساط|تحصيل|تحصيلات|متأخر|مستحق|إيراد|عمولة|مهمة|مهام|موافقة|موافقات|سير عمل|مخزون|لوحة|تحليلات|وكيل|مبيعات|أطلس)/;
const META =
  /\b(what can you do|who are you|what are you|how do (i|you)|how to|help me (with|use)|your (capabilities|features)|hello|hi there|hey|thanks|thank you)\b/i;
const META_AR = /(ماذا تفعل|من أنت|كيف (أ|ا)ستخدم|كيف يمكنني|ساعدني|مرحبا|شكرا|أهلا)/;

// Obviously out of scope — general knowledge, coding, content generation, etc.
const OUT_OF_SCOPE =
  /\b(write (me |a |some )?(code|a program|a script|a poem|an essay|a story|a song)|python|javascript|typescript|c\+\+|sql query|regex|recipe|weather|stock price|bitcoin|crypto|who (is|was) the|capital of|translate this|tell me a joke|current events|news|football|movie|celebrity)\b/i;

@Injectable()
export class ScopeGuard {
  constructor(
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    @Inject(ASSISTANT_CONFIG) private readonly config: AssistantConfig,
  ) {}

  /**
   * Decide whether a request belongs to Atlas's domain. Order: cheap allow
   * heuristics → cheap deny heuristic → short follow-ups (with history) → one
   * minimal classifier call. Fails **open** (allows) on a classifier error —
   * the system prompt is the backstop.
   *
   * Ported from `mizan/backend/app/lawfirm/assistant/scope-guard.ts`.
   */
  async check(message: string, hasHistory: boolean): Promise<ScopeDecision> {
    if (this.config.scopeEnforcement !== "strict") return { inScope: true, via: "disabled" };

    const m = message.trim();

    if (IN_SCOPE.test(m) || IN_SCOPE_AR.test(m) || META.test(m) || META_AR.test(m)) {
      return { inScope: true, via: "in_heuristic" };
    }
    if (OUT_OF_SCOPE.test(m)) {
      return { inScope: false, via: "out_heuristic" };
    }
    // "yes", "the second one", "and last month?" — a terse reply only makes
    // sense as a follow-up to an in-scope thread, which the guard already vetted.
    if (hasHistory && m.split(/\s+/).length <= 7) {
      return { inScope: true, via: "followup" };
    }

    try {
      const resp = await this.ai.createChatCompletion({
        messages: [
          { role: "system", content: CLASSIFIER_PROMPT },
          { role: "user", content: m.slice(0, 600) },
        ],
        tools: [],
      });
      const inScope = /\bIN_SCOPE\b/i.test(resp.content) && !/\bOUT_OF_SCOPE\b/i.test(resp.content);
      return { inScope, via: "classifier" };
    } catch (err) {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "scope classifier failed — allowing",
      );
      return { inScope: true, via: "classifier_error" };
    }
  }
}

const CLASSIFIER_PROMPT = `You route requests for "Atlas Copilot", an assistant that ONLY helps with one real-estate developer's portfolio data and workflows: projects, buildings, units and inventory, leads and the sales pipeline, customers, reservations, contracts, payment plans and installments, collections/outstanding balances, commissions, tasks, and how to use the Atlas app.

Classify the user's message:
- IN_SCOPE — asks about the portfolio's projects/units/leads/customers/reservations/contracts/collections/tasks/analytics, or how to do something in Atlas, or is a short follow-up to such a topic, or a greeting/thanks.
- OUT_OF_SCOPE — general knowledge, current events, math or coding help, writing unrelated content (poems, essays, code), translation, real-estate market research not tied to this portfolio's own data, personal chit-chat, or anything a real-estate operations assistant would not handle.

Reply with exactly one token: IN_SCOPE or OUT_OF_SCOPE.`;
