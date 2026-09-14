import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import { ProjectsRepository } from "@atlas/realestate/properties/projects-repository.js";
import { FinanceQueries } from "@atlas/realestate/finance/finance-queries.js";
import { AssistantRepository } from "./assistant-repository.js";
import { CANNED_SUGGESTIONS, matchCannedTopic, type CannedAnswer } from "./assistant.domain.js";

@Injectable()
export class AssistantService {
  constructor(
    private readonly repo: AssistantRepository,
    private readonly projects: ProjectsRepository,
    private readonly finance: FinanceQueries,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  conversations(userId: string) {
    return readInTenant(() => this.repo.listConversations(userId));
  }

  messages(conversationId: string) {
    return readInTenant(() => this.repo.messages(conversationId));
  }

  suggestions() {
    return CANNED_SUGGESTIONS;
  }

  async ask(conversationId: string | undefined, question: string, userId: string) {
    return this.uow.transaction(async () => {
      const conv = conversationId
        ? { id: conversationId }
        : await this.repo.createConversation(userId, question.slice(0, 80));

      await this.repo.addMessage({ conversationId: conv.id, role: "user", text: question });
      const answer = await this.buildAnswer(question);
      const aiMessage = await this.repo.addMessage({
        conversationId: conv.id,
        role: "ai",
        text: answer.text,
        stats: answer.stats,
        rows: answer.rows,
        cites: answer.cites,
        follow: answer.follow,
      });
      return { conversationId: conv.id, message: aiMessage };
    });
  }

  /**
   * Keyword-matched canned answers (no LLM — see assistant.domain.ts). "outstanding" and
   * "velocity" compute from real data; the rest are honest placeholders rather than
   * fabricated numbers, same spirit as Mizan Copilot's original stub decision.
   */
  private async buildAnswer(question: string): Promise<CannedAnswer> {
    const topic = matchCannedTopic(question);

    if (topic === "outstanding") {
      const accounts = await this.finance.outstandingAccounts();
      const total = accounts.reduce((sum, a) => sum + a.overdueEgp, 0);
      return {
        text: `EGP ${(total / 1_000_000).toFixed(1)}M is outstanding across ${accounts.length} accounts.`,
        rows: accounts.slice(0, 5).map((a) => ({ name: a.customerId, value: `EGP ${a.overdueEgp.toLocaleString()}`, meta: `${a.agingDays}d overdue` })),
        cites: ["realestate_installments · live"],
        follow: ["Escalate the oldest accounts", "Show collection trend by project"],
      };
    }

    if (topic === "velocity") {
      const projects = await this.projects.list();
      const sorted = [...projects].sort((a, b) => Number(b.velocityPerWeek) - Number(a.velocityPerWeek));
      return {
        text: sorted.length
          ? `${sorted[0].name} leads at ${sorted[0].velocityPerWeek} units/week across the portfolio.`
          : "No project velocity data yet.",
        rows: sorted.slice(0, 5).map((p) => ({ name: p.name, value: `${p.velocityPerWeek} u/wk`, meta: `${p.sellThroughPct}% sold` })),
        cites: ["realestate_projects · live"],
        follow: ["Forecast the top project's sell-out date"],
      };
    }

    return {
      text: "I don't have enough live data to answer that precisely yet — this topic isn't wired to a real query yet.",
      rows: [],
      cites: [],
      follow: this.suggestions().slice(0, 3),
    };
  }
}
