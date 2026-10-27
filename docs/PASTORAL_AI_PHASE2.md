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
