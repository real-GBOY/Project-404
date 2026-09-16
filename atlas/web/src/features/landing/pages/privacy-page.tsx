import { Link } from "react-router-dom";
import { InfoPageLayout } from "../info-page-layout";

export function PrivacyPage() {
  return (
    <InfoPageLayout eyebrow="Privacy" title="Privacy notice">
      <p>
        Atlas RE OS is a demo product built to showcase a real, working system — this notice describes what actually
        happens, not a boilerplate policy for a company that doesn't exist.
      </p>
      <p>
        <strong>Demo data.</strong> The leads, customers, units, contracts and payments visible in the demo are entirely
        fictional, seeded for demonstration. No real customer, buyer or property data is stored anywhere in this system.
      </p>
      <p>
        <strong>Accounts.</strong> If you register your own account rather than using the pre-filled demo login, your email
        and a hashed password (Argon2id — the plain password is never stored) are kept in the application database to
        authenticate you. Session tokens are short-lived and rotate on refresh.
      </p>
      <p>
        <strong>Third parties.</strong> Fonts are loaded from Google Fonts. Signed-in requests to the AI Copilot are sent to
        Groq's API to generate a response; no other data leaves this system. There is no analytics or advertising tracking
        on this site.
      </p>
      <p>
        <strong>Deleting your data.</strong> If you registered a real account and want it removed, reach out via the{" "}
        <Link to="/contact">contact page</Link>.
      </p>
    </InfoPageLayout>
  );
}
