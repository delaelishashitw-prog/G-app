# Invitation and password recovery corrections

Registration uses administrator invitations. Staff Access provides invitation instructions; member accounts are invited and linked from Members → Portal Access.

Email callbacks are captured before Supabase consumes the URL fragment. Invitation/recovery callbacks landing on the home page or staff login are routed to `/auth/password`. Errors are mapped to a fixed message with links to staff and member password help, and error parameters are removed from the URL. An ordinary signed-in session or `?recovery=1` cannot enable the password form.

Password setup verifies the callback token with Auth `getUser`, then binds the form to that account and session. The email address is displayed. Token refresh and MFA upgrades are allowed only within the same Auth session. Account/session switches clear the form. The password write uses a separate, nonpersistent Auth client verified against the bound account, so a concurrent sign-in cannot redirect it to another account. No extra tokens, callback flags, or passwords are saved in browser storage. Existing MFA checks and account approval remain required.

## Required hosted Auth settings

The repository's `supabase/config.toml` declares the intended settings. Updating that file or deploying the app **does not update hosted Supabase Auth configuration**. The connected Supabase tools cannot modify these dashboard switches. A project administrator must apply:

1. Authentication → Sign In / Providers: turn **Allow new users to sign up** off.
2. Leave the Email provider enabled and turn **Confirm email** on.
3. URL Configuration: Site URL `https://g-app-pi.vercel.app`; allow `https://g-app-pi.vercel.app/auth/password`.
4. Set the Auth minimum password length to 12 or more.

Use Supabase's supported Auth controls rather than an insert-only database workaround: rejecting new Auth rows alone does not cover public signup requests against already pending invitations. No custom Auth-table trigger is installed by this correction. Existing accounts, approvals, invitations, and credentials are not altered.

At review time, the live public settings endpoint returned `disable_signup=false` and `mailer_autoconfirm=true`. These remain a release limitation until the dashboard switches are changed. Normal administrator invitations and existing-user sign-in are intended to remain available after disabling public signup.

## Validation

Unit checks cover absent/invalid links, verified identity, session changes, MFA/refresh continuity, and password-write races. Browser checks use synthetic accounts on mobile and desktop for errors at the home/password/login routes, valid invitation and recovery callbacks, mismatch validation, account switches, reloads, and first staff password setup followed by mandatory MFA. The complete existing suite is also required. No live password change or invitation email is used for these checks; email delivery remains a separate live verification step.
