import { Link } from "react-router-dom";
import { InfoPageLayout } from "../info-page-layout";

export function CareersPage() {
  return (
    <InfoPageLayout eyebrow="Careers" title="There's no team hiring here — yet">
      <p>
        Atlas RE OS is a demo product, not a company with open roles. There's no applicant tracker behind this page and no
        job descriptions to browse.
      </p>
      <p>
        If you're reading this because you're evaluating the work itself — the codebase, the architecture, the AI Copilot,
        the multi-tenant data model — that's exactly what this page exists to be honest about instead of faking a careers
        board. Take a look at <Link to="/about">what Atlas is</Link>, or reach out directly on the{" "}
        <Link to="/contact">contact page</Link>.
      </p>
    </InfoPageLayout>
  );
}
