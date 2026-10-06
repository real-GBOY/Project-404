import { api } from "@/api";
import type { SecurityStatus } from "@/api/types";
import { useI18n } from "@/hooks/use-i18n";
import { messageFor } from "@/services/api-error";
import { C } from "@/styles/colors";
import { FORM } from "@/styles/form-styles";
import { useSecurityAction, type Flash } from "./use-security-action";

/** Sign out everywhere else. */
export function SessionsSection({
  sec,
  setFlash,
}: {
  sec: SecurityStatus;
  setFlash: (f: Flash | null) => void;
}) {
  const { i } = useI18n();
  const { busy, run } = useSecurityAction(setFlash);
  const revoke = () =>
    run(
      async () => {
        await api.account.revokeSessions();
        setFlash({ ok: true, text: i.S("acct_sessDone") });
      },
      (e) => messageFor(e, i.S("acct_failed")),
    );
  return (
    <section style={FORM.card} aria-labelledby="sess-h">
      <h2 id="sess-h" style={FORM.sectionHeading}>
        {i.S("acct_sessTitle")}
      </h2>
      <span style={{ color: C.text.body }}>{i.S("acct_sessBody")}</span>
      {sec.sessionMinutes > 0 ? (
        <span style={{ fontSize: 13, color: C.text.secondary }}>
          {i.S("acct_idleNote", { n: sec.sessionMinutes })}
        </span>
      ) : null}
      <button
        style={{ ...FORM.ghostButton, alignSelf: "flex-start" }}
        disabled={busy}
        onClick={() => void revoke()}
      >
        {i.S("acct_sessRevoke")}
      </button>
    </section>
  );
}
