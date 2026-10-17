# Staff two-factor authentication

Super administrators, senior pastors, administrators and finance officers must verify a time-based authenticator (TOTP) before opening church records. Other roles with an already verified factor must also complete MFA. A verified email, active login and reviewed staff role are still required.

## First sign-in

1. Sign in with your own email and password. Invited users choose their initial password through their invitation first.
2. At **Secure your account**, enter a device name and choose **Start authenticator setup**.
3. Add the QR code to your authenticator. On the same phone, open **Enter setup key manually**, add a time-based account and enter the key privately.
4. Enter its current six-digit code and verify. The setup is unfinished until the code is accepted.
5. In the profile menu, open **Two-factor security** (also in Settings → Security) and add a backup authenticator on a separate device or in a secure password manager. Verify the backup too.

Later password sign-ins ask for an authenticator code. An already verified session can continue until it expires or is revoked; this does not ask for a code on every page. MFA sign-in and enrollment need an internet connection. TOTP codes themselves do not require SMS or mobile credit. Ordinary member portal accounts without enrolled MFA keep their existing email/password sign-in.

## Change or lose a device

Sign in using a remaining verified authenticator. Add the new device and verify it. To remove an old device in the app, enter a fresh code from the authenticator you are keeping. The app will not remove the last verified authenticator through its device management screen. Removing factors directly through the Auth API cannot bypass the staff requirement: access remains blocked until a factor and AAL2 session are present.

If setup was interrupted before verification, the next visit lists it as **Not verified**. Discard that unfinished setup and begin again; the old QR/secret is deliberately not stored on the device. Do not discard a verified working authenticator as part of a retry.

If **all authenticators are lost**, only the church's trusted Supabase project owner can recover the account:

1. Independently verify the exact person's identity and exact Auth UUID using the church's established process. An email message, display name, password reset or editable user metadata is not approval.
2. Use Supabase Auth's supported administrator controls to remove the lost factors for that specific user and revoke their sessions globally. Do not directly edit Supabase-managed Auth tables. Keep this operation in the owner-controlled Auth audit trail.
3. Have that person sign in privately, enroll and verify a new authenticator, then create a backup. The account remains gated while no verified factor exists.
4. For a lost root authenticator, use an independently secured Supabase project-owner account with its own MFA and recovery access. Another application staff member cannot bypass root MFA. Keep that owner access usable before relying on a single authenticator.

Never send passwords, setup keys or authenticator codes in chat or support messages. There is no shared override code, self-service MFA bypass, application recovery token, or in-app staff reset of someone else's factors. A password reset does not remove MFA. Supabase Auth supports multiple authenticators; this implementation uses a verified backup rather than generating custom recovery codes.

## Enforcement and rollout

`gwcc_security_status()` returns only the caller's canonical role, required flag, verified factor count and satisfied flag. It is available at AAL1 for bootstrap, along with the existing self-profile read. It returns no church records, factor names, seeds or account directory.

`current_user_role()` returns `disabled` until required MFA passes. The private implementation checks the protected profile, verified email, ban state, signed JWT `aal2`, a verified factor and the live `auth.sessions` row for that user, session and factor. Revoked or expired sessions, removed factors, stale AAL2 tokens and password-only sessions fail closed. All record RLS rules, media storage policies, mutation/recovery/backup RPCs and role-based quotas use this canonical role. Authenticated SMS preview/history additionally use it; service-only dispatch bookkeeping follows the authenticated API guard.

Both Express/Vercel handlers and Supabase Edge handlers call the same database security check before quota consumption or privileged provider/Auth operations. The client keeps a partial sign-in only for MFA setup/challenge; it does not load church records or attach the sync outbox until verification succeeds. A gate clears the account's read cache while preserving its separately owned durable outbox, operation IDs and held work. This feature does not add at-rest encryption to the app's existing offline storage.

Deploy the security bootstrap/UI and both shared Edge handlers before enabling the database role guard. Test the UI using synthetic sessions and local SQL fixtures; do not enroll real accounts, send codes by SMS, reset production credentials, or forge production JWTs as a test. After release, each affected person must complete setup privately on their next visit.

References: [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa), [TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp), [Unenroll](https://supabase.com/docs/reference/javascript/auth-mfa-unenroll).
