# Workout gym membership gate and club announcement SMS

## Workout plans

Personal workout program purchase and gym membership are separate. Own workout plan content is withheld from trainee state responses unless that trainee has an active Open Gym entitlement (standalone Open Gym or an included group membership). The client also gates the program tab and direct personal display route, including cached/demo data. Staff access and authorized calendar-linked group programs are unchanged; nutrition plans are unchanged.

Membership checks use the club date, the gym plan's own expiry, verified recurring setup/failed-charge state, pending payment, freeze and cancellation. A later workout/nutrition expiry must not revive an expired gym plan. No purchase or declaration is deleted. Missing expiry requires correcting the membership record rather than guessing.

## Announcements

Home shows up to three latest matching club notices before the greeting, with a button for all notices. SMS, push and home share age/gender/membership targeting (including secondary memberships; date of birth overrides cached age).

Manager opts in to **send this announcement also by SMS**, then confirms before publishing. This calls a manager-only endpoint, atomically saving the announcement and a snapshot of its SMS recipients. Replay of the same draft ID is idempotent; changed content requires a new draft. Without SMS selection, existing in-app publishing behavior is unchanged. Pages demo never sends real SMS.

The existing minute scheduler processes up to 20 recipients per club per tick, at most four provider requests concurrently. Existing Pulseem configuration is reused (no new credential). Phone numbers are normalized and deduplicated per announcement, including shared family numbers. Invalid/missing phones are counted and skipped. Announcement deletion cancels still-queued jobs; already dispatched SMS cannot be recalled. Recipient snapshots are not exposed in trainee payloads or editable through client state sync.

Permanent database claims prevent duplicate sends across concurrent workers/restarts. `ACCEPTED` means provider acceptance, **not handset delivery**. Ambiguous failures are `FAILED_OR_UNKNOWN` and are not automatically retried, because the provider may already have sent the message. A crash after dispatch claim can remain `DISPATCHING`; reconcile such cases with Pulseem, never blindly resend. The manager receives queue counts, not a false delivery-success message.

Only appropriate club service notices should use this feature; it does not establish marketing consent. Long Hebrew messages can incur multiple SMS segments, disclosed before confirmation. No real SMS is sent by automated tests; they inject a synthetic provider.

Schema changes are optional JSON fields only, keeping the prior image/database compatible for rollback. An older image does not process this outbox and may omit unfamiliar fields on a state save; review pending jobs before rolling forward again. Permanent database claims must not be cleared when recovering the queue.
