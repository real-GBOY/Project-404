import { useNavigate } from "react-router-dom";
import type { Me } from "@/api/types";
import { useAuth } from "@/features/auth/auth-context";
import { useI18n } from "@/hooks/use-i18n";
import { C } from "@/styles/colors";
import { FORM } from "@/styles/form-styles";
import { FONT } from "@/styles/typography";

/** A slim bar for real (non-demo) sessions: who is signed in, the account page, sign out. */
export function AccountBar({ me }: { me: Me }) {
  const auth = useAuth();
  const { i } = useI18n();
  const navigate = useNavigate();
  return (
    <div
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "5px 14px",
        background: C.chrome.bgDeep,
        color: C.chrome.textMuted,
        fontSize: 12,
        fontFamily: FONT.sans,
      }}
    >
      <span style={{ color: C.brand.onDark }}>{i.L(me.name)}</span>
      <span dir="ltr" style={{ fontFamily: FONT.mono, fontSize: 11 }}>
        {me.email}
      </span>
      <button
        onClick={() => navigate("/account/security")}
        style={{ ...FORM.barButton, marginInlineStart: "auto" }}
      >
        {i.S("acct_title")}
      </button>
      <button onClick={() => auth.logout()} style={FORM.barButton}>
        {i.S("acct_signOut")}
      </button>
    </div>
  );
}
