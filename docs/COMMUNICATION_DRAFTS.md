# Communication drafts

Communication prepares saved SMS, WhatsApp and announcement drafts. Saving does not send, schedule or publish a message. A delivery provider and verified delivery receipts must be implemented separately before automatic sending is offered. Individual WhatsApp conversations are opened for the user to review and send manually.

## Draft lifecycle

New draft starts a separate record. Repeated saves update the same draft ID. Edit draft restores its channel, audience, group, sender and contents; Copy as new draft creates a separate record. Copy message waits for clipboard confirmation. Archive and Restore preserve the message and its saved audience rather than deleting it. Imported historical delivery records can be copied to new drafts.

Drafts stay visibly pending until cloud acknowledgement. Device-save confirmation waits for durable outbox persistence. A device-storage failure keeps the in-memory copy and reports the failure; keep the tab open and export pending changes before reloading. Retried operations retain their original operation IDs. Cloud versions prevent stale edits from silently overwriting newer versions.

## Audiences and phone numbers

Current members include active members, leaders, new members and new converts. Archived, inactive, transferred and deceased members are excluded. Closed or converted visitor records are excluded from visitor audiences. Matching audiences use the recorded ministry or small-group ID. Phone formatting is normalized and duplicate numbers are included once, using a stable member ID to resolve ties. Missing and invalid numbers appear in the exclusions preview. The original directory contacts are never altered.

Ghana local numbers, `+233` and `00233` formats are supported. Missing subscriber digits are not guessed. Other international numbers are checked for E.164-style syntax; format validation does not prove that a number exists or supports SMS/WhatsApp.

The database resolves the audience from current directory data on each content save rather than trusting a client-supplied count or list. Drafts retain group identity and the selected IDs. The editor warns when current directory membership differs from the saved selection. Archive/restore preserves the snapshot. Old drafts with unknown audiences are retained and require explicit audience review when edited. Drafts with no valid recipients may still be saved for later; no delivery is attempted.

## Validation and access

Titles use 1–200 characters, messages 1–5,000 characters and sender IDs 1–11 letters, numbers, spaces or hyphens. The page, store and database enforce these limits before or during persistence. SMS segment costs are not fabricated.

Only reviewed super administrators, senior pastors, administrators, pastors and ministry leaders can use the Communication module or read its records. Attendance officers, data-entry staff, finance officers, ordinary members and anonymous users cannot read communication drafts through the database. The client also avoids loading draft caches for those roles. New records bind the creator to the signed-in Auth user, preserve that creator on edits and record the updating user.

The Ministry announcement action uses the same draft store and recipient rules and describes its outcome as a saved draft awaiting cloud confirmation. No messages are sent by the regression checks; browser data and WhatsApp targets are synthetic and intercepted.
