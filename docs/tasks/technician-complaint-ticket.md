# Technician ticket from complaint

**Priority:** P1 follow-up to the technician workspace

## Goal

Let a signed-in technician create a field ticket directly from an in-scope
complaint. The ticket is linked to the complaint, the water point's location is
updated from the technician's confirmed site information, and the change is
visible in the complaint timeline.

## Agreement gate

- Backend: AGREE WITH NOTE — same-scope transaction and documented contract.
- Frontend: AGREE WITH NOTE — labeled, keyboard-accessible action and errors.
- Security / Data Handling: AGREE WITH NOTE — composite scope constraint and
  minimal technician access; free text is number-scrubbed.
- Phone / AI Prompter: AGREE WITH NOTE — post-call action, no caller data.
- UX: AGREE WITH NOTE — prefilled water point and explicit save.

## Acceptance criteria

- Technicians can view complaint details but only have `view` and
  `technician_ticket` permissions.
- The complaint detail shows an “Add field ticket” action for technicians.
- The server validates complaint, water point, organization, and region scope.
- The ticket, water-point update, and history event commit atomically.
- Complaint status and report-derived facts are not overwritten.
- Linked ticket information appears on the complaint detail.
- Ticket text is capped and number-scrubbed; no caller details are requested.
- The database enforces the complaint link's composite scope.
