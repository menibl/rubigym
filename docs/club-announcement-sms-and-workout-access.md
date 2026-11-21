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

### Provider diagnostics

New dispatch attempts store an optional `diagnostic` on the server-owned delivery record:
`recordedAt`, `reason`, HTTP status (when received), and bounded/redacted provider
`code`, `status`, `message`. The same fields are logged under
`Club announcement SMS failed or unknown` / `Club announcement SMS accepted by provider`.
No raw response, headers, credentials, recipient phone/hash, message body or arbitrary
exception text is logged. Trainee state still excludes the outbox; generic client
state updates cannot forge/erase these diagnostics. Transport/timeouts are distinguished
from provider rejection; a missing provider code is not invented or interpreted as
insufficient credit. Accepted is still not proof of handset delivery.

Read-only operator lookup: `sudo /usr/local/sbin/gymflow-ops logs | grep -A 15 'Club announcement SMS' | tail -n 100`.
Old failures have no recoverable provider diagnostic and are not retried by this update.
A deliberate resend must be a separately confirmed new announcement; do not clear old
claims or reset failed jobs. Deploy the diagnostic update before that send so its results
are captured. Diagnostic collection itself does not change targeting, billing or OTP
request parameters; the separate announcement reference change is described below.

### UUID reference and one-number test

Announcement deliveries now store a separate random UUID `providerReference`, used in
both Pulseem `sendId` and `referenceList`, matching the UUID shape used by OTP. Internal
outbox IDs, phone deduplication, publication fingerprints and permanent claim keys are
unchanged. Old pending jobs without this optional field are retained as
`FAILED_OR_UNKNOWN` / `LEGACY_REFERENCE_REVIEW_REQUIRED`, without sending, minting a
new provider identity or clearing a claim. Previously claimed, accepted, dispatching
or failed jobs are NOT reset or retried. This prevents an automatic audience replay
under new IDs before the one-number test. Rollback uses the same permanent claims.
The reference-length difference is a suspected compatibility issue, not a proven
provider restriction; verify the live one-number result before any club-wide send.
OTP request parameters and all other SMS callers are unchanged.

Diagnostics also project nested error/data/result containers, arrays, validation
messages and plain text errors. HTML bodies are omitted. Only known diagnostic values
are traversed; raw request/response bodies, credentials and arbitrary fields are never
saved. Recipient data, message text, OTP tokens and URLs are redacted. Depth, number of
nodes/details, and text length are bounded, with `truncated` marked when appropriate.
Safe top-level field names and response type help identify unsupported response shapes
without copying arbitrary values. A nested explicit failure on HTTP 200 is not accepted
as successful dispatch. Provider acceptance is still not handset delivery.

Manager-only `POST /api/admin/announcements/sms-test` supports a read-only `preview`
and an explicitly confirmed `send` of the selected notice to ONE supplied valid mobile.
The confirmation binds the preview text fingerprint. It does not create another notice,
target the audience, send push, or reset existing jobs. A distinct permanent test key is
derived from notice ID + normalized phone: repeat clicks/concurrent requests/restarts
only return the existing status, never create another test. Failed tests are not retried.
This is a deliberate separate test copy, not an automatic resend of failed audience jobs.
The manager UI is collapsed by default, never sends on mount, and requires preview and
confirmation. The refresh button never sends. Demo mode refuses the API call.

Production sequence: merge through staging/MAIN after human approval, verify the active
production SHA and health, send the approved notice to the explicitly authorized single
number, inspect diagnostic and provider acceptance, then obtain/retain the appropriate
approval before any audience send. No real SMS is sent during automated tests.

Schema changes are optional JSON fields only, keeping the prior image/database compatible for rollback. An older image does not process this outbox and may omit unfamiliar fields on a state save; review pending jobs before rolling forward again. Permanent database claims must not be cleared when recovering the queue.
