import { InfoPageLayout } from "../info-page-layout";

export function ContactPage() {
  return (
    <InfoPageLayout eyebrow="Contact" title="Get in touch">
      <p>Atlas RE OS is one repository in a larger project. The fastest way to reach whoever's behind it is through the code itself:</p>
      <p>
        <a href="https://github.com/real-GBOY/Project-404" target="_blank" rel="noreferrer">
          github.com/real-GBOY/Project-404
        </a>{" "}
        — open an issue, or find contact details on the profile that owns the repository.
      </p>
      <p>Looking for a live walkthrough instead of a message? The whole product is one click away — sign in with the demo credentials pre-filled on the login screen.</p>
    </InfoPageLayout>
  );
}
