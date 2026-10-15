# GWCC Church Management

React, TypeScript, Supabase and Vite application for membership, attendance, pastoral care, giving, welfare and church finance. It runs on Express or Vercel's serverless functions.

## Set up

Use Node 24 LTS and install the locked dependencies:

```sh
npm ci
cp .env.example .env
```

Set the Supabase browser and server variables to the same project. Keep `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` on the server; never prefix them with `VITE_`.

Apply the database migrations and bootstrap one verified administrator as described in [the rollout guide](docs/SECURITY_ROLLOUT.md). Supabase authentication and the security migration are required. Staff access uses email invitations and protected database profiles. There are no local login fallbacks, shared passwords or demo accounts.

```sh
npm run dev
```

For a production Express server:

```sh
npm run build
NODE_ENV=production npm start
```

For Vercel, use the Vite preset, `npm ci`, `npm run build`, and output directory `dist`. Configure the environment variables before building. `/api/ai/assistant` and `/api/staff` share the same authorization code with Express. Follow the rollout guide before routing production traffic to the new build.

## Verify

```sh
npx playwright install chromium
npm run verify
```

Verification regenerates the in-app SQL from the migrations, type-checks the code, runs regression tests including PostgreSQL/RLS integration tests, builds production assets, and tests the browser against a local production server. Browser tests use isolated synthetic accounts and mocked Supabase HTTP responses. Database tests execute the migrations in PGlite; they do not connect to a live Supabase project.

## Data and integrations

- Writes enter a persistent queue scoped to the verified Auth user. A stable operation ID makes retries idempotent. Related welfare and treasury changes commit together. Rejected changes remain visible and can be exported for reconciliation.
- Financial account balances are maintained in database transactions. Corrections and voids reverse the appropriate ledger effects; posted finance records retain their history.
- Cached records are scoped to an account and cleared on sign-out. Cloud reads are paginated, accept empty results and preserve pending edits. Initial sample records are never merged into production data.
- Member accounts link to `members.auth_user_id`; names, phone suffixes and editable Auth metadata do not grant access.
- Duty notifications are persisted in Supabase and read under ownership rules, with Realtime plus polling. No separate WebSocket server is required.
- SMS is a draft workflow until a real provider adapter is configured. The app does not report delivery, scheduling or gateway balances without a provider. WhatsApp links open a draft for the user to review and send in WhatsApp.
- Member-entered giving does not create a verified payment. Finance staff record receipts after verifying payment through the church's payment channel.

See [the audit resolution and remaining rollout work](docs/SECURITY_ROLLOUT.md). Code checks do not establish that a production database or hosting account has been upgraded.
