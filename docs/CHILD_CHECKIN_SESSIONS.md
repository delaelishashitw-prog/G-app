# Child check-in session selection

Child Safety Tags uses the service and Ghana date selected on the Attendance page. The form displays that session, and both printable passes identify the saved service and date. Recorded check-in times use Africa/Accra even when a staff device uses another timezone.

Opening the form starts a fresh check-in for the selected session. It no longer preselects an unrelated child's tag. Verify Pickup Stub opens pickup verification directly and searches only records in the selected service/date, while retaining the existing authorized-collector checks. Missing, archived and future sessions do not allow new check-ins; saved tags remain available from their own session history.

The mobile and desktop regression covers the second service in the list, a previous date, a staff device set to Pacific/Auckland, roster isolation, printable session details, fresh forms, rejection of another session's pickup tag and successful release of the matching child. All test families and API responses are synthetic.
