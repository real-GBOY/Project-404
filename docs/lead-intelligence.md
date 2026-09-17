# Atlas AI Lead Intelligence & Property Matching

> Status: v1 shipped (backend + web).
> Module: `atlas/backend/app/realestate/lead-intelligence/` — an **Atlas**
> capability, not AURIC Core. Reuses Core's `AiClient`/`ASSISTANT_CONFIG`
> (exported from `assistant/assistant.module.ts` for this purpose) rather
> than standing up a second AI provider client.

## What it is

A workflow on the existing Lead resource: an agent pastes a client's
free-text requirements (English, Arabic, or a mix), and Atlas turns that into
a structured requirement profile, ranks real available inventory against it
with a deterministic, explainable score, recommends a next action from plain
business rules, and — best-effort — drafts a human explanation and a client
message.

```
Atlas web (Lead detail → AI Intelligence tab)
  → POST /realestate/leads/:id/ai/requirements   (analyze:lead)
  → LeadIntelligenceService.extractRequirements
  → StructuredAi (AI_CLIENT, no tools, JSON-only) → Zod-validated LeadRequirements
  → LeadsRepository.setRequirements                (persisted on the lead)

  → POST /realestate/leads/:id/ai/brief          (analyze:lead)
  → LeadIntelligenceService.getBrief
  → UnitsRepository/ProjectsRepository/BuildingsRepository (read-only, RLS-scoped)
  → matchUnitsToRequirements  (pure, deterministic — lead-matching.domain.ts)
  → recommendNextAction        (pure, deterministic — next-action.domain.ts)
  → StructuredAi (best-effort explanation + draft message; deterministic
     fallback on failure — buildDeterministicExplanation/-Message)
```

## The one architectural rule that matters

**The LLM never decides which unit is a match.** It has two jobs, both
single-shot text-in/JSON-out completions with `tools: []` — never a
tool-calling loop, never database access:

1. **Extraction** — turn free-text notes into `LeadRequirements`
   (`domain/requirements.schema.ts`), Zod-validated with one repair retry.
   Deliberately asks for a *relative* delivery offset
   (`deliveryWithinMonths`, e.g. "within two years" → `24`) rather than an
   absolute date — date arithmetic against "today" is exactly the kind of
   judgment call kept out of the model's hands; the matching engine computes
   the real deadline itself.
2. **Explanation** — given the *already-computed* score, reasons and next
   action for the top matches (nothing else — no other lead's data, no raw
   unit table access), write 1–3 sentences for the agent and a draft client
   message. If this call fails or the assistant isn't configured, the brief
   still returns successfully with a deterministic templated explanation/
   message (`aiGenerated: false` in the response) — AI enhances the
   experience, it is never a hard dependency for the core result.

Everything in between — matching, scoring, ranking, the recommended next
action — is plain, unit-tested arithmetic in
`domain/lead-matching.domain.ts` and `domain/next-action.domain.ts`. No
model output can change a score or make an unavailable unit appear as a
recommendation.

## Matching algorithm

`matchUnitsToRequirements` (mirrors `dashboard/domain/likely-to-sell.domain.ts`'s
style): only `status: "available"` units are ever candidates. Each stated
requirement dimension contributes a 0–100 sub-score at a fixed weight; a
dimension the lead never mentioned is left OUT of the average entirely
(never defaulted to a fake 100) and the result is renormalised over only the
dimensions actually stated:

| Dimension | Weight | Signal |
|---|---|---|
| Budget | 30 | unit price vs. `budgetMinEgp`/`budgetMaxEgp`, graded falloff outside range |
| Location | 25 | any `locations[]` term found in the project's name/location (binary) |
| Type / bedrooms | 20 | bedroom count (parsed from `unit_type`, e.g. `"3-Bed"` → 3) within range, and/or a `propertyTypes[]` keyword match |
| Floor | 10 | unit floor in `preferredFloors[]`, graded falloff by distance |
| Delivery | 15 | building `handover_date` (or `status: "delivered"`) vs. `deliveryWithinMonths` |

Weights are read directly from `WEIGHTS` in `lead-matching.domain.ts` — this
table is descriptive, not a second source of truth.

## Persistence — why three columns, not a new table

`realestate_leads` gained `requirements_notes` (raw agent text),
`requirements` (JSONB, `LeadRequirements`), `requirements_extracted_at`
(migration `20260917130000_lead_requirements`, hand-written SQL — see its
header comment for why `prisma migrate dev` is never used in this project).
No new table: re-running extraction costs a real LLM call, and persisting
the result lets the agent revisit/edit it without re-paying that cost.
Matches themselves are **never** persisted — they're recomputed live against
current inventory on every "Generate Sales Brief" so a sold unit can never
show up as a stale recommendation.

## Authorization

New permission `analyze:lead` (`crm/permissions/permissions.ts`), granted to
`sales_agent`, `sales_manager`, `commercial_director` and `administrator` —
not `finance_controller` or `read_only`. Both endpoints sit behind the
standard `JwtAuthGuard` + `PermissionGuard`; the service itself calls other
domains' *repositories* only (never their services), inheriting
`organization_id` scoping + Postgres RLS the same way `DashboardService`
does. No AI tool, no raw database access is ever exposed to the model.

## Tests

- `tests/lead-matching.domain.test.ts` — 14 cases: exact/partial match,
  budget/location/bedroom/floor/delivery mismatches, unavailable-unit
  exclusion, multiple candidates, determinism, score ordering.
- `tests/next-action.domain.test.ts` — the 7 business-rule branches.
- `tests/structured-ai.test.ts` — JSON extraction, markdown-fence stripping,
  retry-then-succeed, give-up-after-two-failures, not-configured,
  upstream-failure passthrough.
- `tests/lead-intelligence.integration.test.ts` — end to end against real
  Postgres: extraction (valid/mixed-language/retry/failure/provider-down),
  brief generation against real seeded inventory, the AI-unavailable
  fallback, tenant isolation, and the `analyze:lead` permission grant.
- `atlas/web/src/features/crm/pages/lead-detail-page.test.tsx` — loading,
  error, empty, successful extraction, validation-error, successful brief,
  AI-unavailable badge, no-matches empty state, permission-denied error,
  copy-to-clipboard (never auto-sent).

## Demo data

`demo-data.ts#DEMO_LEADS` seeds `requirementsNotes` (raw text only — never a
pre-computed AI result) on two existing leads: "Tarek ElGohary" with the
bilingual Arabic/English example from the product brief, and "Mona Fahmy"
in English. "Analyze Requirements" runs for real against the configured
provider from either lead's seeded notes.

## Not done / known limitations

- Candidate fetching loads the org's full unit/project/building set (same
  as `DashboardService.unitsLikelyToSell`) rather than pushing budget/floor
  filters to SQL — fine at this portfolio's scale, would need DB-side
  pushdown filters before a much larger inventory.
- No dedicated HTTP/e2e test layer exists anywhere in this backend (every
  other Atlas module tests at the service layer through the full DI graph +
  real Postgres, not via `supertest`) — this module follows the same
  convention rather than introducing a new one.
- The suggested message is a draft only; there is no outbound WhatsApp/email
  integration in Atlas to actually send it, by design (§11 of the brief).
