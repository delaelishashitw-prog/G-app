# GWCC Staging Pastoral Security Acceptance

This test package provides **real HTTP/API checks**, not mocked browser authorization. It is isolated from production by exact matching the staging Supabase project and the protected Phase 2 staging preview host. It reads confidential tasks only to verify role restrictions, never prints records, never modifies church information, and never sends messages.

## Status and safe setup

- GitHub Actions workflow: `.github/workflows/staging-pastoral-security.yml`, **manually triggered only**.
- Staging test runner: `scripts/staging-pastoral-security.mjs`.
- Unit tests: `tests/stagingPastoralSecurity.test.js` (run by ordinary `npm test`).
- The workflow currently has **no secret injection**. Running it before connecting the secrets will fail at configuration validation. This is deliberate; a missing secret must never silently count as a pass. **Never paste credentials or MFA secrets into code, workflow YAML, issue comments, chat, or logs.**
- A repository administrator must configure a dedicated `gwcc-staging-security` GitHub Actions environment with required reviewers, environment secrets, and the runner's env mappings. Do not enable this on untrusted pull-request code.
- Use **distinct, synthetic staging-only accounts** for every tested role. Prefer dedicated CI service testers rather than human accounts.

## Protected CI environment inputs

Configure these *environment secrets*:

| Secret | Usage |
| --- | --- |
| `GWCC_STAGING_ANON_KEY` | Supabase public/anon key for `gvnkviqnjyrsilorlofx` only; never service role |
| `GWCC_STAGING_VERCEL_BYPASS_SECRET` | Dedicated Vercel Automation Bypass secret for protected staging preview, not production |
| `GWCC_STAGING_TEST_USERS` | JSON object of staging-only synthetic test credentials; never production credentials |

Set the workflow step environment to read the three secret values and provide two *literal* non-secret URLs. An administrator can add this `env` block to the workflow's `staging-security` job after approving the setup:

```yaml
    env:
      GWCC_STAGING_API_ORIGIN: https://g-app-git-feature-pastoral-ai-phase2-dickedem.vercel.app
      GWCC_STAGING_SUPABASE_URL: https://gvnkviqnjyrsilorlofx.supabase.co
      GWCC_STAGING_FULL_MATRIX: 'true'
      GWCC_STAGING_ANON_KEY: ${{ secrets.GWCC_STAGING_ANON_KEY }}
      GWCC_STAGING_VERCEL_BYPASS_SECRET: ${{ secrets.GWCC_STAGING_VERCEL_BYPASS_SECRET }}
      GWCC_STAGING_TEST_USERS: ${{ secrets.GWCC_STAGING_TEST_USERS }}
```

The JSON secret must map roles to credentials in this exact shape (replace examples securely within GitHub; **never commit actual values**):

```json
{
  "super_admin": {"email": "ci-super@staging.example.invalid", "password": "PLACEHOLDER_ONLY", "totpSecret": "STAGING_ONLY_BASE32_SECRET"},
  "administrator": {"email": "ci-admin@staging.example.invalid", "password": "PLACEHOLDER_ONLY", "totpSecret": "STAGING_ONLY_BASE32_SECRET"},
  "pastor": {"email": "ci-pastor@staging.example.invalid", "password": "PLACEHOLDER_ONLY"},
  "member": {"email": "ci-member@staging.example.invalid", "password": "PLACEHOLDER_ONLY"},
  "finance_officer": {"email": "ci-finance@staging.example.invalid", "password": "PLACEHOLDER_ONLY"},
  "attendance_officer": {"email": "ci-attendance@staging.example.invalid", "password": "PLACEHOLDER_ONLY"},
  "data_entry": {"email": "ci-data@staging.example.invalid", "password": "PLACEHOLDER_ONLY"},
  "ministry_leader": {"email": "ci-leader@staging.example.invalid", "password": "PLACEHOLDER_ONLY"},
  "disabled": {"email": "ci-disabled@staging.example.invalid", "password": "PLACEHOLDER_ONLY"},
  "unreviewed": {"email": "ci-unreviewed@staging.example.invalid", "password": "PLACEHOLDER_ONLY"},
  "mfa_incomplete": {"email": "ci-no-mfa@staging.example.invalid", "password": "PLACEHOLDER_ONLY"}
}
```

Do not use `example.invalid` as a real email; it is a non-deliverable placeholder. For full CI, create real staging-only inbox identities and verify them. To test `disabled`, disable the **profile** after initial authentication registration while keeping the synthetic Auth account usable for a sign-in attempt; the API must deny access. For `unreviewed`, leave the staff profile unapproved. For `mfa_incomplete`, choose an approved Administrator account with a fresh AAL1 password session and no successful TOTP challenge. Optionally supply `totpSecret` for Pastor if a verified factor is enrolled.

Enable `GWCC_STAGING_FULL_MATRIX=true` only when all eleven synthetic accounts are ready. This makes incomplete role coverage an error. Never use normal member, pastor or administrator production accounts to power CI.

## What the staging acceptance suite verifies

- Only exact staging API and staging Supabase hosts are accepted; production URLs and service-role keys are rejected.
- No session and malformed token receive **401**; unsupported methods receive **405**; caller-supplied SQL/table parameters receive **400**.
- Super Administrator and Administrator sessions must complete TOTP and reach AAL2 before a **200** response; unverified sessions must receive **403**.
- Pastor and other permitted roles receive **200** only with their authorized session.
- Member and other excluded roles receive **403**.
- Disabled, unreviewed and MFA-incomplete synthetic accounts receive **403**.
- Successful response has only aggregate status and count keys; no names, phone numbers, notes, case narratives, member IDs or record details.
- Counts must match only the user's assigned open and overdue task records from the staging follow-up RPC.
- Administrator must not see pastoral tasks via the follow-up RPC nor read follow-up documents through the direct table query.

The suite does **not** test revocation of active sessions by mutating users in CI; that requires a separately approved staging lifecycle scenario. It also does not replace human code/security review, database advisor remediation, or production observability.

## Execution

1. Complete protected GitHub environment and dedicated staging account setup.
2. Review the code changes and merge the separate test PR only after checking there are no secrets.
3. In GitHub **Actions**, choose **Staging pastoral security acceptance** → **Run workflow** on the reviewed branch.
4. Verify every expected role check is recorded as PASS; any FAIL or missing secret means **not accepted**.
5. Record the run URL and commit, then decide on release remediation without changing production during the test.

## Environment protection and isolation

The script refuses to run unless the specified hosts match:
- `https://gvnkviqnjyrsilorlofx.supabase.co`
- `https://g-app-git-feature-pastoral-ai-phase2-dickedem.vercel.app`

If the preview is removed or rebuilt with different settings, **stop** and re-verify the Git branch, Vercel target, deployment protection, and preview-only Supabase environment variables before using the runner. A ready production deployment does not make this staging security suite redundant.
