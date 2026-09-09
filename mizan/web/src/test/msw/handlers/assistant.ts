import { http, HttpResponse } from "msw";
import { nextId } from "../fixtures/db";
import type { ChatResponse } from "@/features/assistant/api/assistant.api";

/**
 * Test double for `POST /api/ai/chat` (real on the backend — see
 * `mizan/backend/app/lawfirm/assistant`). It does not run a model; it produces a
 * deterministic response shaped like the real one so component tests can assert
 * on the rendered transcript, tool chips, loading and error states.
 *
 * A message containing "fail" returns a 503 so the error path can be exercised.
 */
const transcripts = new Map<string, Array<{ role: "user" | "assistant"; content: string; at: string }>>();

export const assistantHandlers = [
  http.post("/api/ai/chat", async ({ request }) => {
    const body = (await request.json()) as {
      conversationId?: string;
      message: string;
      currentContext?: { screen?: string; matterId?: string };
    };

    if (/\bfail\b/i.test(body.message)) {
      return HttpResponse.json(
        { code: "assistant.upstream_unavailable", message: "The assistant is temporarily unavailable." },
        { status: 503 },
      );
    }

    const conversationId = body.conversationId ?? nextId("conv");
    const wantsData = /hearing|task|invoice|matter|client|overdue|calendar|payment|expense/i.test(
      body.message,
    );
    const res: ChatResponse = {
      conversationId,
      message: wantsData
        ? "Based on your firm's data, you have 2 hearings this week and 1 overdue task."
        : "I can help with hearings, tasks, clients and billing. What do you need?",
      toolActivity: wantsData
        ? [{ name: "get_hearings", ok: true, mutates: false }]
        : [],
      usage: { promptTokens: 120, completionTokens: 40, totalTokens: 160 },
    };

    const log = transcripts.get(conversationId) ?? [];
    log.push({ role: "user", content: body.message, at: new Date().toISOString() });
    log.push({ role: "assistant", content: res.message, at: new Date().toISOString() });
    transcripts.set(conversationId, log);

    return HttpResponse.json(res);
  }),

  http.get("/api/ai/conversations/:id", ({ params }) => {
    const id = String(params.id);
    return HttpResponse.json({
      id,
      title: transcripts.get(id)?.[0]?.content ?? null,
      messages: transcripts.get(id) ?? [],
    });
  }),

  http.get("/api/ai/conversations", () =>
    HttpResponse.json({
      items: [...transcripts.keys()].map((id) => ({
        id,
        title: transcripts.get(id)?.[0]?.content ?? null,
        updatedAt: new Date().toISOString(),
      })),
    }),
  ),
];
