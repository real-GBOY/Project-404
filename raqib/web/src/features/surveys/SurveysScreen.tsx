import { SurveysPanel } from "@/components/SurveysPanel";
import { useI18n } from "@/hooks/use-i18n";
import { C } from "@/styles/colors";

/**
 * Surveys, open to every role: anyone signed in answers an open survey; the people the General Manager names also manage them.
 * It is its own screen (not part of the confidential area) because a named manager need not hold any confidential access.
 */
export function SurveysScreen({ pad, title }: { pad: string; title: string }) {
  const { i } = useI18n();
  return (
    <div
      style={{
        padding: pad,
        maxWidth: 820,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{title}</h1>
        <div style={{ fontSize: 13, color: C.text.secondary }}>{i.S("sv_intro")}</div>
      </div>
      <SurveysPanel />
    </div>
  );
}
