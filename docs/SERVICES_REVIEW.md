# Services review

Service statistics resolve explicit IDs first. ID-less legacy records can match a unique exact normalized service name. Deleted IDs, ambiguous names, unrelated giving, pending/voided gifts and duplicate check-ins do not inflate service totals. Cards show the latest recorded session; the spotlight distinguishes session attendance from historical attendance. The weekly attendance target is an estimate, not a physical seating capacity.

The next/live spotlight refreshes every 30 seconds in GMT (Africa/Accra). Overnight services remain live after midnight. Calendar exports include UTC timestamps, correct overnight end dates and escaped/folded text. Stage timers count elapsed time after browser throttling and understand hour/minute durations.

Attendance and giving links retain the chosen service. Giving links open the service-filtered ledger. Restricted staff can view schedules without service, liturgy, roster or bulk-confirmation editing controls. Roster confirmation sends a structured status update. New assignments begin pending; member linking requires an unambiguous name, phone or explicit identifier. Placeholder ministers and fallback notification phone numbers are removed. Clipboard actions report success only after the copy succeeds.

Service announcement fields persist in the database. Referenced services are deactivated rather than deleted. Foreign keys reject new broken service links and protect existing referenced services. They are installed NOT VALID to preserve legacy orphaned records for explicit review. No historical record is automatically reassigned using a similar name.

Verification covers service identity resolution, duplicate attendance, giving totals, GMT/overnight boundaries, validation, member identity ambiguity, calendar text safety, database persistence/permissions/history safeguards, and browser navigation/edit/roster/export/read-only/deactivation workflows.
