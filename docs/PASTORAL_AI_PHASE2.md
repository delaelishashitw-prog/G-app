# GWCC Pastoral AI — Phase 2 (development branch only)

## Current release review (29 October 2026)

**Status: automated verification passed; draft PR #32 remains unmerged; no production rollout authorized.** Older dated sections below are historical setup/QA snapshots, not the current account-creation status.

- The Phase 2 feature branch is 18 commits ahead of `main` and not behind as of review. GitHub Actions **Verify app** run **#142**, commit `245939ec49557002c3ad820568f3d6f709bf6bfb`, completed successfully: 284 unit tests passed, all browser smoke tests including Events and Member Directory passed, schema-generation diff check passed, and the production-dependency audit reported 0 vulnerabilities. Vercel commit status is successful. These test runs use synthetic fixtures.
- Isolated staging project `GWCC Staging` (`gvnkviqnjyrsilorlofx`) has a verified Super Administrator, two approved Pastor test accounts, two approved Administrator test accounts, and one linked Member Portal test account. Accounts were created via Supabase Auth, not by writing directly to `auth.users`. User-confirmed browser tests: Super Administrator Pastoral Intelligence, Pastor AI Assistant access, Administrator AI Assistant access after MFA, Member Portal access, and member redirect away from staff-only Assistant. The second Administrator had one verified MFA factor and an `aal2` session at inspection.
- Read-only security review verified `gwcc_follow_up_list` invokes `gwcc_private.follow_up_list`, whose query filters tasks with `gwcc_private.task_visible` and checks staff security state. Synthetic task visibility checks showed that Administrator and Member cannot see a Pastor's pastoral task, while the assigned Pastor can. Direct `gwcc_documents` and `visitors` SELECT policies rely on `gwcc_can_read`; under the reviewed function, Administrator does not receive direct permission to read follow-up task documents.
- **Remaining live release acceptance:** a deliberate end-to-end HTTP/API test with authenticated staging identities confirming `403` for Member and excluded staff on `/api/ai/pastoral-overview`, `200` for each permitted role after MFA where required, and confidential pastoral-task denial for Administrator through the actual app/RPC. Confirm suspended/unreviewed accounts and role revocation fail closed, preview deployment is still protected and points to staging, and check there are no private fields in responses. The successful browser navigation and SQL helper checks are not substitutes for those account-specific negative tests.
- PR #32 had no submitted review or inline review threads at this check. Obtain an independent security/code review and explicit production release approval before changing draft status, merging or deploying. **Do not merge into `main` automatically.** Production frontend and Supabase remain unchanged by these Phase 2 staging checks.


This release adds a separate AI UI permission and a read-only Pastoral Intelligence panel.

## Security boundary
- `/api/ai/pastoral-overview` requires a verified, reviewed, MFA-satisfied staff session, checks the caller's profile twice, and uses the existing per-account AI rate limit.
- Only `super_admin`, `senior_pastor`, `administrator`, and `pastor` can access this overview.
- Supabase queries use the caller's Authorization JWT and existing RLS, never a service-role key. They retrieve visitor IDs and statuses only. The response contains **aggregate counts**, never IDs, names, phone numbers, prayer requests, counseling notes or task descriptions.
- The follow-up RPC is the existing `gwcc_follow_up_list`, filtered in the server to tasks assigned to the current verified user. No task is created or updated.
- This endpoint does not send data to Gemini. Existing sermon drafting and attendance-report endpoints remain separate.
- The route accepts only an empty JSON object and cannot execute arbitrary tools or model-supplied SQL.

## Integration points
- Route: `/assistant`; sidebar permission: `ai_assistant`.
- Express handler: `server/aiPastoralOverview.js`.
- Vercel handler: `api/ai/pastoral-overview.js`.
- UI: `src/components/PastoralIntelligencePanel.tsx`.
- Database: **no schema migrations**. Relies on current `visitors` RLS and `gwcc_follow_up_list`.

## Before merging to main
Run `npm ci`, `npm run lint`, `npm test`, and `npm run build` in a trusted checkout. Then run the existing browser tests in isolated staging. Confirm every role's access, MFA, suspension, RLS, empty tables, and large visitor datasets. Verify serverless route discovery and deployment configuration in Vercel preview. Do not put test member records into production.

## Deferred on purpose
No direct contacts list, automated SMS, WhatsApp send, member absence ranking, counseling record retrieval, payment actions, AI-issued task creation, or AI approval queue is implemented in this change. Design and test those behind explicit human approvals in subsequent work.

## Staging isolation gate (verified 27 October 2026)
Read-only inspection found **one connected Supabase project** (`noskcrmvnancdyhvzfin`) and **no Vercel custom environment or branch-specific preview variables** for `feature/pastoral-ai-phase2`. The Preview and Production targets both define the shared variable names `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, and `APP_ORIGIN`. **Do not assume the preview database is separate.** Environment values were not decrypted or compared.

**Release blocker:** Before real account or end-to-end role testing, explicitly authorize and provision a dedicated staging Supabase project (or separately approved isolated database). Creation may incur costs. Use a full migration-based schema, the existing role/RLS functions, and **synthetic-only** accounts and visitors. Do not copy any production church records, passwords, tokens, phones, counseling or giving data.

**Safe setup sequence, requiring separate approval for resource/environment mutations:**
1. Provision a distinct staging Supabase project under an approved organization/plan. Record its project ref and region without putting credentials in version control.
2. Apply and verify repository migrations to staging only; enable RLS on exposed tables, preserve MFA and role review, and deploy the required staging Edge Functions. Never run project migrations against production as a shortcut.
3. Create synthetic reviewed, MFA-enrolled users for each role (including a disabled account) and sample visitors and follow-up tasks. Use synthetic phone and email domains that cannot reach real recipients.
4. Set branch-scoped Preview environment variables in Vercel so both browser `VITE_SUPABASE_*` and server `SUPABASE_*` point to the staging project. Rotate preview-only credentials where appropriate. Do not decrypt existing secrets into logs or pull-request comments.
5. Keep the preview under Vercel deployment protection. Confirm exact deployment commit, branch, and environment independently before making any authenticated requests.
6. Test: no session 401; invalid/disabled/unreviewed/MFA-incomplete 403; allowed pastoral roles 200; finance, attendance, data-entry and members 403 for `/api/ai/pastoral-overview`; visitor RLS and task ownership; zero visitors/tasks; sensitive-field leakage; rate limiting; no SQL, send-message or write endpoints invoked.
7. Only after role and preview checks pass, review the draft PR and separately approve promotion/merge. The current read-only code does not perform any AI-scheduled actions.

**Current status:** code and browser-fixture checks passed in GitHub Actions using synthetic data, and a Vercel preview is READY. **Authenticated integration against an independent staging database has not been run.**

## Branch-scoped Supabase staging configuration (27 October 2026)

- Created independent Supabase project `GWCC Staging` (`gvnkviqnjyrsilorlofx`), eu-west-1. Applied all 32 schema migrations; all 31 public application tables have RLS enabled. No member, visitor, attendance, profile or task records were copied.
- Added **branch-scoped Preview-only** Vercel overrides for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` on Git branch `feature/pastoral-ai-phase2`. Values point at the staging Supabase project and are not recorded in Git. Existing production/ordinary preview variables were not edited.
- Changing Vercel environment variables does not retroactively change already built deployments: a new preview build is required, and its environment and Vercel protection must be verified before treating it as staging.
- No staging Auth users, Edge Functions, real church data or messages have been created. Test account authorization, preview deployment, redirection and role behavior still require independent verification.

## Staging fixture and ownership QA (28 October 2026)

**Verified, staging only:** the deployment for `feature/pastoral-ai-phase2` displayed the expected aggregate counts after four fictional visitor records and three fictional follow-up tasks were created in `GWCC Staging` (`gvnkviqnjyrsilorlofx`). The signed-in, MFA-verified staging super administrator confirmed dashboard values of 4 visitors, 2 awaiting follow-up, 2 assigned open tasks, and 1 assigned overdue task. One completed task is excluded from open counts. No messages were sent, no production records copied.

Read-only database checks on the staging project confirmed:
- The authorization helper `gwcc_private.task_kind_allowed` denies pastoral task kinds to ordinary members, finance officers and administrators; pastors can handle pastoral tasks, while general church administrators can handle visitor tasks.
- The task visibility helper `gwcc_private.task_visible` restricts a pastor's unassigned pastoral task visibility while allowing tasks assigned to that pastor; global pastor/admin roles follow the specifically intended scopes. For the actual staging fixtures, 2 open tasks belong to the staging super administrator and none to a different, nonexistent test identity.
- Anonymous role has **no direct SELECT grant** on visitors or `gwcc_documents` and **no EXECUTE grant** on `gwcc_follow_up_list`.
- A separate, transactional test temporarily inserted one fictional task assigned to a different identity and verified the administrator's two assigned open tasks stayed unchanged, that unrelated pastors could not view the other task, and that an assigned pastor could. The test was explicitly rolled back; a subsequent database query verified zero temporary tasks remain (3 persistent test tasks and 4 visitors).

**Not yet verified:** actual end-to-end requests authenticated as real different roles, MFA enrollments for additional roles, and production-like API authorization regression under active sessions. These require separate staging Auth accounts; do not claim full role-security acceptance until that check passes. Production is unchanged and PR remains unmerged.

## Additional role regression coverage (28 October 2026)

- Staging Auth currently has only one approved account: the verified `super_admin`. No real sign-in accounts for `pastor`, `administrator`, `finance_officer`, or `member` have been created. Do not claim these roles were exercised in an authenticated end-to-end session.
- Expanded `tests/aiPastoralOverview.test.js` to assert the four authorized roles are allowed by the handler; five excluded roles are denied before querying; owned active and overdue tasks exclude other users' tasks and completed/cancelled tasks; malformed task responses and failed visitor queries are rejected.
- These are **mocked handler regression tests**, not substitutes for real Supabase Auth role tests. The draft PR must not be promoted until independent authenticated staging checks run.
- No production settings or records were changed. No permanent Auth test users were provisioned.
