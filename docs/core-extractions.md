# Core extractions — what was proven shared, what was not

Branch `refactor/core-extractions`. Principle: **build → use → discover repetition → extract**.
Only code that Mizan and Atlas had *both* written, with the same behaviour, moved. Everything else
stayed with its product.

## Extracted

| What | Where it lives now | Product keeps |
| --- | --- | --- |
| Prefixed NanoID factory | `core` (`createPrefixedId`) | its own prefixes |
| RBAC contracts (`PermissionDefinition`, `RoleSeed`, `permKey`) | `core` | its permissions, roles, seed data |
| User directory (`userId → display name`) | `core` | — |
| `StructuredAi` (prompt → JSON → validate → repair retry) | `core/assistant` | lead-intelligence prompt + schema |
| `ScriptedAiClient` test double | `core/assistant/tests` (products re-export it) | — |
| App bootstrap | `core/http/bootstrap.ts` → `bootstrapAuricApp` | root module, migrate fn, seed fn, identity |
| Web transport: `ApiError`, token store, single-flight refresh, fetch client | `packages/web` (`@auric/web`) | endpoints, API/domain clients, claim shape, storage key |
| Messaging wire contracts for the web | `core/messaging/contracts/index.ts` consumed in place as `@auric/contracts/messaging` | Atlas insights contract stays Atlas-owned (`@atlas-contracts/insights`) |

`bootstrapAuricApp` takes four things: `module`, `identity`, optional `migrate`, `seed`. It is not an
options bag — products register routes/modules through their own Nest root module.

## How the web packages are consumed

Source-only, by Vite alias + tsconfig `paths` (no npm workspace, no build step, each app keeps its own
lockfile). Consequence: **the Vercel projects must have "Include source files outside of the Root
Directory" enabled** (Vercel's default for new projects) because `mizan/web` and `atlas/web` now import
`../../packages` and `../../core/messaging/contracts`.

## Behaviour notes

- `ApiError` now unwraps the backend's `{ error: { code, message, details } }` envelope. Mizan's
  previous version read a flat body, so against the real backend it saw `code: "unknown"` and a generic
  message; it now surfaces the real code/message/field errors. Flat bodies are still accepted.
- The token store keeps the refresh token in memory as a fallback when storage is unavailable (Atlas
  already worked this way; Mizan now does too).
- The drift test for copied messaging contracts was deleted: there are no copies any more.

## Intentionally not extracted

| Candidate | Why |
| --- | --- |
| Assistant controllers | Routes, permissions (`use:assistant` vs `ask:ai_conversation`) and request schemas are each product's public API. A controller factory would be a decorator-generating abstraction for two 50-line files. |
| Assistant modules | The DI wiring *is* the product binding (which tools, which domain modules). |
| Scope vocabulary, system prompts, tools | Domain content. |
| Conversation analysis (`atlas/.../conversation-intelligence`) | Only Atlas uses messaging. The mechanism (coalescing, single-flight, retry, persistence) is generic in shape but has one caller; extracting now means designing the API from a single example. **Future candidate** the day Mizan adopts messaging. |
| Atlas's axios layer | Atlas uses axios for blob download and upload-with-headers. It shares `ApiError`, token store and refresh with Mizan but keeps its own transport. Rewriting it onto fetch would be a behaviour change with no gain. |
| Admin adapters, demo seeders, search ranking, design systems, page chrome | Structurally similar, semantically product-specific (Plan §7). Wait for a third product. |
| Deploy/migrate scripts | `scripts/deploy-*.sh` and Atlas's `migrate.ts` differ in paths, service names and databases; the only shared piece (`migrateToLatest`) is already Core's. |

## Known remaining duplication

- Mizan and Atlas web each have their own auth provider, query client and upload helper.
- `mizan/web` and `atlas/web` design primitives and toast/confirm components.
- Both backends' assistant module wiring (by design, see above).

## Pre-existing failures observed (not caused by this work)

- `mizan/web` `calendar-page.test.tsx` fails on the pre-refactor baseline as well.
- Atlas `assistant-live.integration.test.ts` calls the real Groq API and fails when the token quota is
  exhausted (HTTP 429).
