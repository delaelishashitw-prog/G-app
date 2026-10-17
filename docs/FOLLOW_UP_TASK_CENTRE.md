# Follow-up Task Centre

Open **Task Centre** from the sidebar. New tasks have a responsible staff account, a required due date, a priority, an optional record link and a server-recorded creator. Staff can track open, in-progress, completed and cancelled work, filter by their own assignments, and review who changed or completed a task.

## Scheduling and completion

Administrators can use **Needs scheduling** to turn eligible visitor or pastoral follow-up records into explicit assignments. Historical typed coordinator names are not automatically converted into account ownership. Select a real staff account and a due date before saving. Only active, reviewed logins with a verified email and suitable category access appear as assignees. A pending staff invitation is not an eligible assignee.

Visitor tasks link to an open visitor record. Only one open task may exist for a visitor at a time; closing a task permits a later follow-up, while reopening cannot create a second simultaneous assignment. Pastoral tasks can link to a member, care record or visitation. Their category and source record are fixed after creation. Cancel and replace a task to change those links.

The assignee or an administrator can start or complete a task. Completion needs an outcome. Cancellation and reopening require a reason. Completed work retains its actor and time in task history; reopening preserves the previous completion event. No task is physically deleted through the application. Completing a task does not convert a visitor to membership or change the source care record.

Dates use the Ghana calendar (GMT). Due today is separate from overdue; completed and cancelled tasks do not count as overdue. Header alerts and the sidebar show tasks that the signed-in staff member is allowed to access.

Task changes require an internet connection and cloud confirmation. Repeated submission of the same operation applies its change once and returns the latest task state. Compact retry receipts avoid duplicating the complete history. Stale edits fail with an instruction to refresh. An interrupted form retains its input and operation ID for a safe retry. Refreshing does not automatically resubmit an uncertain action.

## Visibility and delegation

- Super administrators and senior pastors can manage all task categories.
- Administrators can manage general and visitor tasks, including delegation. They cannot see pastoral tasks.
- Other staff see tasks they created or are assigned to. Finance officers use general tasks only.
- Pastoral tasks are restricted to the involved authorised pastoral accounts and senior leadership. Pastors can delegate within that category.
- Members have no staff task access. A disabled account or lost role loses access on the next server operation, including an attempt to replay an earlier successful request.

An unavailable assignee is flagged for review and reassignment; a directory contact without a login is not treated as an application user. Task assignments produce in-app records and alerts. They do not send emails, SMS or WhatsApp messages.

## Visitor interactions

**Log Pastoral Follow-Up** records the signed-in recorder instead of inserting a preset minister name. The server appends the note under a visitor-row lock and saves a separate authenticated interaction document. Concurrent notes and lost-confirmation retries cannot overwrite or duplicate that history. Visitor dossiers display the verified interaction history separately from older editable notes.

A pipeline status alone cannot claim conversion without a linked, enrolled member. The page routes new conversion choices through member enrollment. The database rejects future conversion writes without a real member link and prevents reopening an already enrolled visitor through an ordinary status edit. Existing historical records are preserved.

## Storage and verification

Tasks and interaction documents use the existing `gwcc_documents` module store, alongside established document modules. Private implementations verify the current protected staff role, category access and record version; public RPC wrappers use `SECURITY INVOKER`. The general sync API cannot write these namespaces. Both task history and interaction history are already included in encrypted exports and the 34-table recovery manifest, so existing recovery files remain compatible.

Regression checks cover owner validation, self-only delegation, pastoral privacy, role loss, reassignment, stale versions, exact retries, duplicate visitor assignments, membership separation, authenticated append-only interaction history and recovery rehearsal. Browser checks use synthetic accounts and include desktop/phone forms, interrupted confirmation, filtering, safe refresh failure, record navigation, literal note rendering and finance-role restrictions. No real outreach or staff assignments are created as tests.
