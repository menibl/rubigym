# Booking conflict retry protection

This change is separate from the staging chat prototype and calendar details refresh PR. It changes no API schema, persisted data schema, payment logic, chat code or existing production registration.

## Cause and scope

The client retries `/api/state` after a revision conflict (409). Previously it rebased only users, payments and messages: stale `sessions` and `openGymSessions` arrays were resubmitted unchanged. A staff save could therefore overwrite newly accepted bookings. This is a reproducible failure path, not proof that a specific missing historical registration was lost this way.

The retry now merges booking intent per occurrence and trainee against the last synchronized baseline. Unchanged local membership takes the current server decision; independent additions and cancellations are combined. Conflicting transitions for the same trainee prefer the server. Queue order is retained and duplicates are avoided. Remotely deleted occurrences are not recreated; concurrent excluded-date additions are retained. Explicit staff occurrence deletions are still respected.

The rebased collections are adopted into the client as well, including the three collections already merged previously. This prevents the next unrelated save from reintroducing the stale state. The retry reads the latest local snapshot after fetching the server, including changes inside the 700 ms autosave debounce. Polling cannot apply a remote refresh over unsaved local edits. Completing an older save does not clear the dirty flag for a newer edit.

If combining concurrent registrations would exceed capacity, or a locally changed booking belongs to an occurrence moved remotely to another date/time, the entire unsaved batch is rejected, the client adopts the authoritative server snapshot, and a warning explains that the booking and any other unsaved edits need to be retried. Rejecting the whole batch also prevents saving a coupled punch-card debit without an accepted booking. It does not automatically reassign or cancel accepted registrations.

## Verification and limits

Deterministic tests cover two-device joins, cancellations, waitlist ordering/promotion, repeated conflicts, deletions, exclusions, capacity refusal, staff authorization merge, and a later unrelated save. All fixtures are synthetic and do not connect to production. Source contract checks cover the asynchronous retry/debounce/UI wiring; these are not a substitute for a two-browser production acceptance check after release.

No historical registrations are recreated. Older frontend bundles still need a page reload after deployment to receive this protection. Production booking verification and recovery, if needed, require separate user authorization and evidence.
