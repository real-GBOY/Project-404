import { InfoPageLayout } from "../info-page-layout";

export function TermsPage() {
  return (
    <InfoPageLayout eyebrow="Terms" title="Terms of use">
      <p>
        Atlas RE OS is a demonstration product. It is provided as-is, for evaluation purposes, with no uptime or support
        commitment.
      </p>
      <p>
        <strong>Demo data is not real.</strong> Nothing you see in the seeded demo — projects, units, prices, contracts,
        payments, people — represents a real property, transaction or person. Do not rely on any figure in this system for
        an actual business or legal decision.
      </p>
      <p>
        <strong>Acceptable use.</strong> Don't use this system to store real personal, financial or otherwise sensitive
        data. It's a portfolio/demo environment, not a production service with the operational guarantees a real
        deployment would need.
      </p>
      <p>
        <strong>No warranty.</strong> The software is provided without warranty of any kind. See the repository's license
        for the exact terms governing the code itself.
      </p>
    </InfoPageLayout>
  );
}
