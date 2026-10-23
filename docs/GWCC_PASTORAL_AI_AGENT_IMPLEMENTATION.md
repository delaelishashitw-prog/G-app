# GWCC Pastoral AI Agent — Secure Integration Blueprint

Status: **Implemented through aggregate attendance report drafts; draft PR, not deployed.** Prepared for the existing `G-app` repository (React/Vite + Supabase + Vercel/Express + Gemini). No production data or secrets are included here.

## Objective and boundaries

Extend the existing `src/pages/AiAssistantPage.tsx` and `src/components/AiAssistantModal.tsx` rather than creating a separate application. Reuse `server/ai.js` and `server/security.js` for verified identity, approved staff roles, MFA status, allowed origin, and request quotas. **Never** let model-generated text execute database queries or mutations. The browser never holds a Gemini key, service-role key, or direct privileged database credential.

The current backend already invokes Google Gemini for text drafting. The first integration adds bounded, server-owned attendance summary/report tools. The general drafting endpoint remains separate and does not retrieve church records. Frontend counts are not an authoritative data source. A proposal/approval workflow for delivery remains future work.

## Trust boundaries

```text
Authenticated GWCC UI
  → POST /api/ai/... (valid Supabase session)
  → server/security.js (verified user, active reviewed profile, MFA, origin, quota)
  → capability authorization (role and explicit data scope)
  → allowlisted tool handler (schema-validated input, capped range, RLS-scoped Supabase client)
  → minimal structured results (no unnecessary personal details)
  → Gemini for narration or message draft (optional for deterministic statistics)
  → proposed actions → human review → permission and recipient recheck → approved delivery
  → immutable audit record
```

## Release 1: safe read-only capabilities

1. **Attendance overview**: by authorised date range and service; return totals and counts, without member names/phones. Use `attendance.date`, `attendance.service_id`, `attendance.status`; no invented attendance percentages or inferred attendance if check-in records are incomplete. Validate date ranges and page queries, enforce maximum response sizes. Show source period and whether data is incomplete.
2. **Visitor summary**: aggregate visitor activity; no identifying information in the LLM prompt by default.
3. **Sermon and event planner**: text drafting via existing Gemini endpoint, with verified/approved event facts, and clear draft status.
4. **Pastoral follow-up preview**: authorised staff may view a targeted list in a separate protected UI, but the model receives only minimally necessary data. Attendance absence is a prompt for respectful check-in, *not* evidence of illness or lack of faith. Never use giving history, counselling records, or prayer requests for segmentation.

Release 1 must not send SMS, WhatsApp, email, modify attendance, modify pastoral notes, change member roles, approve financial transactions, or initiate payments.

## Role/capability matrix (proposed; enforce server-side)

| Existing role | Sermon & general drafting | Aggregate attendance | Follow-up draft preview | Identifiable pastoral notes | Finance |
| --- | --- | --- | --- | --- | --- |
| `super_admin` | Yes | Yes | Yes (approved scopes) | No default AI access | Aggregates only when explicitly approved |
| `senior_pastor` | Yes | Yes | Yes | Human-only by default | Approved aggregates |
| `administrator` | Yes | Yes | Yes | No | No |
| `pastor` | Yes | Yes | Yes | Human-only by default | No |
| `attendance_officer` | Limited drafting | Yes | No | No | No |
| `ministry_leader` | Yes | Only scoped ministry aggregates (later) | No | No | No |
| `finance_officer` | General drafting | No | No | No | Explicit approved finance aggregates (later) |
| `data_entry` | Limited drafting | No | No | No | No |
| `member` / unauthenticated | No staff agent access | No | No | No | No |

These are proposed capabilities to add to existing roles, not replacements for current RBAC. `super_admin` is not a blanket override for every sensitive content type. Verify role from protected profile/DB and MFA, **never** name, local flags, browser-selected role, `user_metadata` or a client-provided access scope.

## Existing GWCC modules and model privacy rules

- **`members`, `visitors`**: contact details must stay in authorised database/UI context; don't send telephone numbers or personal notes to Gemini by default.
- **`attendance`, `services`**: server-only bounded read; return counts by service/date and explicit source coverage.
- **`pastoral_care`, `prayer_requests`, welfare, minors**: excluded from model prompts in the initial release. Never turn pastoral/counselling records into searchable church-wide knowledge.
- **`giving`, `church_finances`**: excluded from first release. No ranking members by contributions or targeting fundraising messages using private records.
- **`communications`**: generate *drafts* only; no delivery claim until the provider confirms delivery. Respect contact consent and opt-outs.
- **`audit_logs`**: record actor UUID, tool name, permitted record scope, timestamp, approval reference and result status. Do not log raw prompts containing member secrets or embed them in error responses.

Review external model data-handling, retention, and residency terms before sharing any person-identifiable church records. Prefer deterministic server aggregation rather than LLM inference for numerical reports.

## Implemented first integration

- `POST /api/ai/attendance-insights`: accepts only `startDate` and `endDate`, up to 31 inclusive days ending no later than today in Ghana. Reads the caller's RLS-protected `attendance` records; caps at 5,000 rows. Pages by stable row ID, requires exact counts, and refuses missing pages, changing totals or repeated IDs. A paginated read is not a database snapshot: refresh after new check-ins sync.
- `POST /api/ai/attendance-report`: accepts the same dates only; recalculates totals on the server. The Gemini input contains only dates and numeric totals, including daily counts. It excludes service labels, service IDs, member/visitor IDs, names, phones and all pastoral/finance data. Stored service text cannot inject instructions into this tool's model input.
- Both routes share `authorizeRequest`: verified Auth user, active reviewed login profile, role, live account security/MFA, origin and persistent `ai` quota. Access is rechecked after reads and after report generation without charging another quota. Existing database policies remain unchanged.
- The approved attendance roles are super administrator, senior pastor, administrator, pastor and attendance officer. Finance officers, ministry leaders, data entry and members do not receive this agent tool. This is narrower than their existing database/module access; do not replace database RBAC with the AI capability list.
- The UI shows source period, source/excluded entries, Ghana refresh time, member/visitor check-ins, service totals and explicit empty/error states. Date edits cancel and discard stale requests. Drafts are kept in component memory, cleared on account/role changes, and copied only on request.
- General drafting and the modal send only the typed/template prompt. Unused browser `churchContext` (including cached counts/staff names) is no longer transmitted. The server supplies the actual model name after a successful response instead of a hardcoded model claim. Templates use placeholders for unconfirmed service times and signatories; model output is escaped text.
- `server/aiProvider.js` keeps the existing `@google/genai` provider, server-only `GEMINI_API_KEY`, optional `GEMINI_MODEL`, existing default model and 20-second provider timeout. No new provider, subscription, package or credential is introduced. Missing configuration and provider failures are visible errors, not successful drafts.
- No model-selected SQL, unrestricted database tools, tool loops, sends, tasks, invitations, edits or financial actions are available. Report wording still needs human review; numeric cards are the deterministic source.

No schema migration is required. Tool-level audit history, visitor proposals, feature flags, per-group rollout and delivery approvals are **not implemented** in this change. The existing API quota is not a provider spending cap; configure provider spending controls before broader use. An autonomous agent is not enabled.

## Future API proposal

- `POST /api/ai/insights/attendance`
  - Input: `{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }`
  - Server: `authorizeRequest` + attendance capability; bounded dates; user-scoped Supabase/RLS reads; fail closed on database error.
  - Output: `{ "period": {...}, "totalRecords": 0, "byService": [], "byDay": [], "complete": true|false, "asOf": "..." }`
  - Never include `member_id`, member name, phone or giving values.
- `POST /api/ai/insights/visitors`: similar aggregate-only tool with its own capability.
- `POST /api/ai/drafts`: existing Gemini drafting under reviewed identity; treat all retrieved data as untrusted text, not instructions.
- `POST /api/ai/proposals`: later release; creates a pending action, **not** a send or mutation.
- `POST /api/ai/proposals/:id/approve`: later release, recompute authorised recipients and consent, check role and MFA again, enforce idempotency key, then pass to an approved delivery gateway.

Do not use a single endpoint that accepts arbitrary table names, raw SQL, dynamic function names or unrestricted `filter` objects.

## Proposed new tables (only after review; migrations not applied)

- `ai_action_proposals`: id UUID PK; created_by UUID; action_kind ENUM/allowlist; status draft/pending/approved/rejected/executed/failed; scope JSONB (validated server-side); content JSONB with appropriate retention and access controls; reviewed_by UUID; reviewed_at timestamptz; created_at/updated_at.
- `ai_tool_audit`: id; actor UUID; capability; input_summary; rows_returned; token/cost counters; approved_action_id; status; created_at. No sensitive prompt or model output by default.
- `ai_config`: administrator-controlled capability flags, per-role limits, model selection, opt-in policies; no client editing of authorization policies.

All exposed tables must have RLS + explicit grants, least-privilege policies, private-by-default audit access. Where possible, keep sensitive working tables in a non-exposed schema and provide audited server functions instead of client access.

## Implementation sequence and acceptance gates

**Gate 0: validate security before personal data.**
- Confirm Vercel and Express use identical `server/security.js` guards.
- Verify Supabase RLS policies using anonymous, member, pastor, attendance officer, and disabled-account test identities.
- Inspect security adviser findings on privileged `SECURITY DEFINER` functions; verify each function's intentional grant, auth checks, secure search path and argument validation.
- Enable leaked-password screening if available; keep browser secrets and plaintext credentials out of repository.
- Ensure MFA, role revocation, read scope and allowed origins behave correctly.
- Confirm provider key is configured only on backend, and rate/cost budgets are active.

**Gate 1: deterministic attendance insights — implemented, automated verification complete.**
- Implement protected server-side aggregation using authenticated user's RLS-scoped client and bounded/paginated reads.
- Add an attendance tile to existing AI page; show last refresh, selected period, counts and source warnings.
- Test: unauthenticated 401; member 403; attendance officer 200; disabled staff 403; missing MFA 403; invalid dates 400; excessive range 400; data access errors explicit; no PII in output.

**Gate 2: aggregate attendance report drafts — implemented; real provider test pending.**
- Feed aggregate statistics only to Gemini to write a reviewable report; never fabricate totals.
- Add source/period labels and a clear "Draft — not sent" status.
- Test malicious prompt injection in stored church text and failed provider requests.

**Gate 3: approved visitor follow-up.**
- Create proposals with distinct recipients, opt-out status, consent and contact channel.
- Admin/pastor review, explicit approve/reject, durable audit and idempotent send.
- Real delivery-status integration required before labeling "Delivered."

**Gate 4: gradual expansion.**
- Discipleship completion, rosters, event planning and authorised finance summaries after independent permission and privacy review.
- No autonomous counselling, claims of divine revelation, disciplinary verdicts, financial transfers, or targeted giving solicitation.

## UI layout

Existing `AiAssistantPage`: add tabs **Overview | Attendance Insights | Visitor Follow-Up | Sermon Studio | Drafts & Approvals | Audit (authorised)**. Reuse existing styling, loading/error conventions and `authenticatedFetch`. Avoid storing confidential generated content in localStorage or persistent browser caches.

## Deployment and verification

Use a draft PR and synthetic test data before touching production. Run `npm run lint`, `npm test`, `npm run test:browser` in CI where configured. Review RLS policies on a nonproduction environment first; do not run schema migrations or enable model access to confidential data without verified guards. Roll out behind a server-controlled feature flag to a small authorised group, then expand after audit and sign-off.

**Decisions before enabling personal-data access:** confirmed role-to-capability map, retention policy, privacy consent and communication rules, service time/date source of truth, recipient-review responsibility, budget and model provider terms.


## Verification and activation record — 23 October 2026

- Based on main `4845c4e` (invitation/password corrections) and preserves giving, welfare, portal, MFA and durable sync changes.
- Local automated validation: 236 tests passed, including the actual request middleware, all allowed/denied roles, verified email, suspension, review, MFA, origin, quota, no-PII model input, stored-text injection exclusion, role revocation and incomplete pagination. PGlite executes the repository migrations with synthetic Auth users/sessions and tests actual attendance RLS, expired sessions and MFA. No production identity is impersonated.
- Browser coverage (synthetic APIs/provider): phone and desktop layouts, pastor/senior administrator/attendance officer access, finance UI exclusion, period changes and discarded stale results, unavailable records/provider, empty results, safe text rendering, minimal request bodies, draft labels, and no generated-content browser persistence. Runs in the full CI suite as well as `TEST_SCOPE=ai`.
- Read-only live inspection confirmed attendance RLS and the existing guarded role/security functions; latest migration remains `20261023063007`. No production records, authentication settings or database definitions were changed.
- Remaining activation checks: review PR/CI; validate approved staff roles and current totals in a nonproduction environment with non-sensitive seeded records; verify the actual configured provider/model with a harmless prompt. Do not claim the real provider works based on mocks. Production activation is separate from this draft PR.
- Existing leaked-password-protection advisor remains unresolved if unavailable on the plan; it is not silently waived or reported fixed by this integration.

Provider API usage follows the installed `@google/genai` README and the official [Gemini text generation documentation](https://ai.google.dev/gemini-api/docs/text-generation). Supabase reads use the existing authenticated client and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security). Review model availability and data-handling terms during activation; no personal-record access is enabled for the model.
