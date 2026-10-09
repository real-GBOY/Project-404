import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api";
import type { Survey, SurveyInput } from "@/api/types";
import { Notice } from "@/components/Notice";
import { QK } from "@/hooks/query-keys";
import { useI18n } from "@/hooks/use-i18n";
import { messageFor } from "@/services/api-error";
import { C } from "@/styles/colors";
import { FORM } from "@/styles/form-styles";

const MODES = ["named", "confidential", "anonymous"] as const;
type Mode = (typeof MODES)[number];
const EMPTY = { ar: "", en: "", qAr: "", qEn: "", rating: "" };

const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Surveys (requirement 17). Anyone signed in answers an open survey, choosing how they are identified; the backend files the
 * answers as confidential reports, so nothing here can read them back. The people the General Manager names also create,
 * publish and close surveys; the General Manager names them.
 */
export function SurveysPanel() {
  const { i, lang } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: [QK.surveys],
    queryFn: () => api.surveys.list(),
    staleTime: 10_000,
  });
  const [flash, setFlash] = useState<{ error: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<Mode>("confidential");
  const [draft, setDraft] = useState(EMPTY);
  const [pick, setPick] = useState("");

  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK.surveys] }),
    onError: (e) => setFlash({ error: true, text: messageFor(e, i.S("sv_failed")) }),
  });

  const data = q.data;
  if (!data) return null;
  const list = data.items;
  const L = (x: { ar: string; en: string }) => x[lang];

  const send = (s: Survey) => {
    const given: Record<string, string | number> = {};
    for (const qu of s.questions) {
      const v = (answers[qu.key] ?? "").trim();
      if (v) given[qu.key] = qu.type === "rating" ? Number(v) : v;
    }
    if (!Object.keys(given).length) return setFlash({ error: true, text: i.S("sv_needAnswer") });
    run.mutate(async () => {
      const r = await api.surveys.answer(s.id, { answers: given, identity: mode });
      setOpen(null);
      setAnswers({});
      setFlash({ error: false, text: i.S("sv_sent", { r: r.ref }) });
    });
  };

  const create = () => {
    const ar = lines(draft.qAr);
    const en = lines(draft.qEn);
    if (!ar.length || ar.length !== en.length)
      return setFlash({ error: true, text: i.S("sv_qMismatch") });
    const ratings = new Set(draft.rating.split(/[,،\s]+/).map(Number));
    const body: SurveyInput = {
      title: { ar: draft.ar.trim(), en: draft.en.trim() },
      intro: { ar: "", en: "" },
      questions: ar.map((text, n) => ({
        type: ratings.has(n + 1) ? "rating" : "text",
        text: { ar: text, en: en[n]! },
      })),
    };
    run.mutate(async () => {
      await api.surveys.create(body);
      setDraft(EMPTY);
      setFlash(null);
    });
  };
  const field = (k: keyof typeof EMPTY) => ({
    value: draft[k],
    onChange: (e: { target: { value: string } }) =>
      setDraft((d) => ({ ...d, [k]: e.target.value })),
  });

  const box = { ...FORM.card, gap: 10 } as const;
  const area = { ...FORM.input, height: 72, padding: 10, fontFamily: "inherit" } as const;
  const small = { ...FORM.ghostButton, height: 32 } as const;

  return (
    <section
      aria-label={i.S("sv_title")}
      style={{
        maxWidth: 720,
        width: "100%",
        margin: "0 auto",
        padding: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {flash ? <Notice tone={flash.error ? "danger" : "success"}>{flash.text}</Notice> : null}

      {list.map((s) => (
        <div key={s.id} style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <strong style={{ fontSize: 15 }}>{L(s.title)}</strong>
            <span style={{ fontSize: 12, color: C.text.secondary }}>
              {i.S(`sv_status_${s.status}`)} · {i.S("sv_qCount", { n: s.questions.length })}
            </span>
          </div>
          {s.status === "active" && open !== s.id ? (
            <button
              type="button"
              style={small}
              onClick={() => {
                setOpen(s.id);
                setAnswers({});
                setFlash(null);
              }}
            >
              {i.S("sv_answer")}
            </button>
          ) : null}
          {open === s.id ? (
            <>
              <span style={FORM.hint}>{i.S("sv_intro")}</span>
              {s.questions.map((qu) => (
                <label key={qu.key} style={FORM.label}>
                  {L(qu.text)}
                  {qu.type === "rating" ? (
                    <select
                      value={answers[qu.key] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [qu.key]: e.target.value }))}
                      style={FORM.input}
                    >
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <textarea
                      value={answers[qu.key] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [qu.key]: e.target.value }))}
                      maxLength={2000}
                      lang={lang}
                      spellCheck
                      style={area}
                    />
                  )}
                </label>
              ))}
              <fieldset
                style={{
                  border: 0,
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <legend style={{ ...FORM.label, padding: 0, marginBottom: 4 }}>
                  {i.S("sv_identity")}
                </legend>
                {MODES.map((m) => (
                  <label
                    key={m}
                    style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "center" }}
                  >
                    <input
                      type="radio"
                      name={`mode-${s.id}`}
                      checked={mode === m}
                      onChange={() => setMode(m)}
                    />
                    {i.S(`sv_id_${m}`)}
                  </label>
                ))}
              </fieldset>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  style={FORM.primaryButton}
                  disabled={run.isPending}
                  onClick={() => send(s)}
                >
                  {i.S("sv_send")}
                </button>
                <button type="button" style={small} onClick={() => setOpen(null)}>
                  {i.S("sv_cancel")}
                </button>
              </div>
            </>
          ) : null}
          {data.canManage && open !== s.id && s.status !== "closed" ? (
            <div style={{ display: "flex", gap: 8 }}>
              {s.status === "draft" ? (
                <button
                  type="button"
                  style={small}
                  onClick={() => run.mutate(() => api.surveys.publish(s.id))}
                >
                  {i.S("sv_publish")}
                </button>
              ) : (
                <button
                  type="button"
                  style={small}
                  onClick={() => run.mutate(() => api.surveys.close(s.id))}
                >
                  {i.S("sv_close")}
                </button>
              )}
            </div>
          ) : null}
        </div>
      ))}
      {!list.length ? <span style={FORM.hint}>{i.S("sv_none")}</span> : null}

      {data.canManage ? (
        <div style={box}>
          <strong style={{ fontSize: 14 }}>{i.S("sv_new")}</strong>
          <label style={FORM.label}>
            {i.S("sv_titleAr")}
            <input style={FORM.input} dir="rtl" lang="ar" spellCheck {...field("ar")} />
          </label>
          <label style={FORM.label}>
            {i.S("sv_titleEn")}
            <input style={FORM.input} dir="ltr" lang="en" spellCheck {...field("en")} />
          </label>
          <label style={FORM.label}>
            {i.S("sv_qAr")}
            <textarea style={area} dir="rtl" lang="ar" spellCheck {...field("qAr")} />
          </label>
          <label style={FORM.label}>
            {i.S("sv_qEn")}
            <textarea style={area} dir="ltr" lang="en" spellCheck {...field("qEn")} />
          </label>
          <label style={FORM.label}>
            {i.S("sv_qRating")}
            <input style={FORM.input} dir="ltr" {...field("rating")} />
          </label>
          <button
            type="button"
            style={FORM.primaryButton}
            disabled={run.isPending || !draft.ar.trim() || !draft.en.trim()}
            onClick={create}
          >
            {i.S("sv_create")}
          </button>
        </div>
      ) : null}

      {data.managers ? (
        <div style={box}>
          <strong style={{ fontSize: 14 }}>{i.S("sv_managers")}</strong>
          <span style={FORM.hint}>{i.S("sv_managersHint")}</span>
          {data.managers.map((m) => (
            <div
              key={m.userId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 13,
              }}
            >
              {L(m.name)}
              <button
                type="button"
                style={small}
                onClick={() => run.mutate(() => api.surveys.unname(m.userId))}
              >
                {i.S("sv_remove")}
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <select
              style={FORM.input}
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              aria-label={i.S("sv_pick")}
            >
              <option value="">{i.S("sv_pick")}</option>
              {(data.candidates ?? []).map((c) => (
                <option key={c.userId} value={c.userId}>
                  {L(c.name)}
                </option>
              ))}
            </select>
            <button
              type="button"
              style={small}
              disabled={!pick}
              onClick={() =>
                run.mutate(async () => {
                  await api.surveys.name(pick);
                  setPick("");
                })
              }
            >
              {i.S("sv_nameOne")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
