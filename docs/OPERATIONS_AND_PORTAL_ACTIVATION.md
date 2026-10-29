# Reliable Inventory, graduation and portal activation

Inventory registration, editing, maintenance and deletion now wait for durable device storage before changing the visible register or closing the form. Failed admissions retain the form and its details. Repeating the original action preserves its operation ID and payload; a changed retry is rejected while that original operation remains pending. Successful admission is labelled as awaiting cloud confirmation, and pending asset rows carry that label. Maintenance entries use a stable request ID.

Foundation School graduation submits the student document and the member's completion flag in one versioned mutation batch. A failed admission changes neither view. Repeated attempts preserve the original certificate and graduation date. Certificates are unavailable while graduation is awaiting cloud confirmation. The additive migration repairs completion flags from existing recorded graduations and adds one system audit entry per repaired member without changing certificates, student history or financial records. The Foundation School page also offers **Update member completion** for a previously recorded graduation whose member flag needs repair.

## Member portal activation

A reviewed, MFA-verified super administrator opens **Members → Portal activation**. The dashboard checks current cloud records and classifies unarchived members as **Needs email**, **Not invited**, **Needs linking**, **Invitation pending**, **Ready to sign in**, or **Needs review**. It supports search, state filters and pagination. Archived members are excluded; deceased/transferred records, missing accounts, staff emails, disabled accounts and conflicting links require review.

The read-only `gwcc_member_activation_overview` RPC calls a guarded implementation in the unexposed private schema. Other roles, anonymous callers, suspended users and incomplete MFA sessions are denied by the database. Its response includes member identity/contact fields and classified state only, with no Auth passwords, tokens or metadata. The dashboard is mounted only for super administrators and discards failed or interrupted snapshots.

**Review access** opens the existing individual account review. No invitation, account link, password reset or message is sent by loading, filtering or refreshing the dashboard. Invitations still require confirming the specific member and email. Pending invitation status is not proof of delivery. Members with verified accounts use the portal's **Forgot password?** option when needed.

## Validation and deployment

Apply the additive migration before publishing the frontend. Regression checks cover storage failure and exact retries, atomic graduation, idempotently audited historical repair, all dashboard account states, role/MFA denial, error/empty states and mobile layout. Automated browser and API fixtures use synthetic identities and do not send messages. A real email-delivery acceptance test requires a specifically chosen recipient and inbox confirmation; automated success must not be described as verified email delivery.
