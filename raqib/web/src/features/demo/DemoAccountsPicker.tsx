import type { FormEvent } from "react";
import { DEMO_MODE, DEMO_PASSWORD } from "@/config";
import { useI18n } from "@/hooks/use-i18n";
import { C } from "@/styles/colors";
import { FORM } from "@/styles/form-styles";
import { FONT } from "@/styles/typography";
import { DEMO_ACCOUNTS } from "./demo-accounts";

/** On the sign-in page of a demo deployment: one click signs in as any seeded role. Renders nothing otherwise. */
export function DemoAccountsPicker({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (e: FormEvent, creds: { email: string; password: string }) => void;
}) {
  const { i, lang } = useI18n();
  if (!DEMO_MODE) return null;
  return (
    <div style={{ ...FORM.card, padding: 14, gap: 0 }}>
      <div style={{ fontSize: 12, color: C.text.secondary, marginBottom: 8 }}>
        {i.S("signInDemo", { p: DEMO_PASSWORD })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            type="button"
            disabled={busy}
            onClick={(e) => onPick(e, { email: a.email, password: DEMO_PASSWORD })}
            style={{
              textAlign: "start",
              border: `1px solid ${C.border.hairline}`,
              borderRadius: 4,
              background: C.surface.paper,
              padding: "8px 10px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <span style={{ fontWeight: 500 }}>{a.label[lang]}</span>
            <span
              dir="ltr"
              style={{
                display: "block",
                fontFamily: FONT.mono,
                fontSize: 11.5,
                color: C.text.secondary,
              }}
            >
              {a.email}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
