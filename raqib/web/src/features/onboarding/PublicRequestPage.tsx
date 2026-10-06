import { FloatingLanguageToggle } from "@/components/LanguageSwitch";
import { useDocumentLanguage } from "@/hooks/use-document-language";
import { useI18n } from "@/hooks/use-i18n";
import { requestVM } from "@/presenters/public";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";
import { AccountRequestPublic } from "@/ui/generated/screens/AccountRequestPublic";
import { usePublicRequest } from "./use-public-request";

/** `/request-account/:org`: the only page an anonymous person can use besides sign-in and password setup. */
export function PublicRequestPage({ org }: { org: string }) {
  const { i, lang } = useI18n();
  useDocumentLanguage();
  const { form, set, info, missing, submit } = usePublicRequest(org);
  const vm = {
    t: i.t,
    ...requestVM(i, form, set, info, submit, () => window.location.assign("/")),
  };
  return (
    <div
      dir={i.dir}
      lang={lang}
      style={{ minHeight: "100vh", fontFamily: FONT.sans, color: C.text.ink, fontSize: 14 }}
    >
      <FloatingLanguageToggle />
      {missing ? (
        <div style={{ padding: 48, textAlign: "center" }}>{i.S("req_inactive")}</div>
      ) : (
        <AccountRequestPublic vm={vm} />
      )}
    </div>
  );
}
