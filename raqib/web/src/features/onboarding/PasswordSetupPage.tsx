import { FloatingLanguageToggle } from "@/components/LanguageSwitch";
import { useDocumentLanguage } from "@/hooks/use-document-language";
import { useI18n } from "@/hooks/use-i18n";
import { setupVM } from "@/presenters/public";
import { C } from "@/styles/colors";
import { FORM } from "@/styles/form-styles";
import { FONT } from "@/styles/typography";
import { PasswordSetup } from "@/ui/generated/screens/PasswordSetup";
import { usePasswordSetup } from "./use-password-setup";

/** `/reset-password?token=…`: set the password from the emailed link. */
export function PasswordSetupPage() {
  const { i, lang } = useI18n();
  useDocumentLanguage();
  const { s, patch, submit } = usePasswordSetup();
  const toSignIn = () => window.location.assign("/");
  const vm = { t: i.t, ...setupVM(i, s, patch, submit, toSignIn) };
  return (
    <div
      dir={i.dir}
      lang={lang}
      style={{ minHeight: "100vh", fontFamily: FONT.sans, color: C.text.ink, fontSize: 14 }}
    >
      <FloatingLanguageToggle />
      <PasswordSetup vm={vm} />
      {s.state === "used" ? (
        <div style={{ textAlign: "center", paddingBottom: 32 }}>
          <button
            onClick={toSignIn}
            style={{
              ...FORM.primaryButton,
              height: 44,
              padding: "0 20px",
              fontSize: 14,
              fontWeight: 400,
            }}
          >
            {i.S("signInNow")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
