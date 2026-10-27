# GWCC Pastoral AI — Phase 2 (development branch only)

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
