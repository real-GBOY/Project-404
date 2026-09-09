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
    ? "أنا مساعد ميزان، وأساعد فقط في أعمال مكتبك داخل ميزان: القضايا والعملاء والجلسات والمهام والمواعيد والتقويم والمستندات والفوترة، وكيفية استخدام النظام. لا أستطيع المساعدة في هذا الطلب."
    : "I'm Mizan Copilot — I only help with your firm's work inside Mizan: matters, clients, hearings, tasks, deadlines, the calendar, documents and billing, plus how to use the app. I can't help with that request.";
}

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

@Injectable()
export class ScopeGuard {
  constructor(
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    @Inject(ASSISTANT_CONFIG) private readonly config: AssistantConfig,
  ) {}

  /**
   * Decide whether a request belongs to Mizan's domain. Order: cheap allow
   * heuristics → cheap deny heuristic → short follow-ups (with history) → one
   * minimal classifier call. Fails **open** (allows) on a classifier error —
   * the system prompt is the backstop.
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

const CLASSIFIER_PROMPT = `You route requests for "Mizan Copilot", an assistant that ONLY helps with one law firm's practice-management data and workflows: matters/cases, clients, hearings, court dates, tasks, deadlines, the calendar, document metadata, invoices, payments, expenses, and how to use the Mizan app.

Classify the user's message:
- IN_SCOPE — asks about the firm's matters/clients/hearings/tasks/deadlines/billing/calendar/documents, or how to do something in Mizan, or is a short follow-up to such a topic, or a greeting/thanks.
- OUT_OF_SCOPE — general knowledge, current events, math or coding help, writing unrelated content (poems, essays, code), translation, legal research not tied to this firm's own data, personal chit-chat, or anything a practice-management assistant would not handle.

Reply with exactly one token: IN_SCOPE or OUT_OF_SCOPE.`;
