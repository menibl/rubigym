# Recurring billing: preparation, not activation

## Current scope

No provider recurring sale is created by this version. `recurringCapabilities()` is deliberately false irrespective of environment switches. Existing plans with no `paymentMode` remain one-off. The checkout server rejects explicit recurring selections, including included family selections, before any provider call or family-credit claim. New recurring plans start hidden.

Managers can prepare payment mode, monthly price, term length (1–36 calendar months), and AUTO or CONFIRM renewal. Registration, purchase and family screens explain this clearly. The agreement checkbox is a **preview only**: no consent is persisted and no mandate is activated. Existing customers must separately consent during the eventual activation flow; editing a catalog entry must never convert their previous one-off payments.

### Calendar policy

- Monthly charge on the 1st in Asia/Jerusalem.
- Until a different business policy is approved, the first charge is the full current calendar month, even if joined late. The initial calendar month counts as the first term month. For example, joining October 15 on a 12-month term ends the term at October 1 next year. This must be shown before consent, not presented as 12 full months from the purchase day.
- Personal/duo cards, packs and nutrition/workout products are not automatically converted.
- Paid access expiry, contract end, provider mandate state, and next charge date are different fields.
- AUTO renews for the same agreed duration only under explicit consent. CONFIRM stops charges when the term ends unless a new agreement is accepted. An SMS reminder alone is not consent.
- Initial family credit/discount may reduce today's one-off payment only. It must not reduce later monthly debits unless the discount contract explicitly applies to subsequent charges.

## Provider-owned state reserved for the next phase

`recurringSubscriptions` and `recurringNotices` are preserved server-side through client state saves, with read access restricted to the manager/own user (not other trainees or coaches). Do not add provider tokens or card details to these records. A subscription should contain:

- Internal id, user/payer id, plan id/name and immutable plan snapshot.
- `status`: PENDING_PROVIDER / ACTIVE / EXPIRING / PAYMENT_FAILED / PAUSED / CANCELLED / ENDED.
- Monthly amount, first charge amount, term months, renewal mode, period start/end and next charge date.
- `providerRecurringSaleId`, verified provider timestamp, immutable consent (terms version, accepted timestamp and server-derived summary).
- Confirmed charge transaction identifiers and cancellation/freeze audit history.

`recurringConsent()` validates explicit acknowledgement of the current terms version against a server-generated summary. It is not a public write endpoint and is not called to activate anything in this phase.

## Prepared reminder flow

SMS/chat templates are prepared for 30 days, 7 days and the expiry date at 09:00–09:59 Israel time. The scheduler uses the durable delivery-claim table to prevent repeated attempts after restarts. It processes only ACTIVE/EXPIRING subscriptions with a verified provider mandate and consent, never ordinary monthly users. `RECURRING_REMINDERS_ENABLED` is disabled by default; it must remain disabled until the authoritative subscription records and live delivery tests are in place.

Each attempt has a durable notice status. PROVIDER_ACCEPTED is **not** proof of delivery to the handset. Missing phone, ambiguous timeout, incomplete attempt or failed request requires manager review. Claims are not released blindly after a timeout, avoiding duplicate SMS. Staff can see the notice status in the payments preparation panel. This panel is read-only; no manual subscription import or resend is exposed.

The current preparation scheduler uses exact-date reminder windows. Before live rollout add a durable due-job queue and controlled missed-window catch-up, bounded retries only for known pre-send failures, and provider delivery reports if available. Never use OTP code quotas as the lifecycle notification quota.

## Mandatory activation work

1. Obtain Rivhit confirmation for the recurring terminal, J5 permissions and designated payment page/token; verify the actual production and test parameters with support.
2. Use the hosted GetUrl flow, not raw card details. Implement monthly day 1, start date, finite charge count/end date and first-charge treatment in TEST. Test joining on day 1 vs mid-month to prevent an immediate charge plus an accidental second charge on the same date.
3. Add an accessible **server-derived final quote** and explicit, non-prechecked consent immediately before redirect. Persist the immutable consent and signed quote before provider submission. Reject stale plan/price/period changes. Require re-consent for material changes.
4. Implement recurring IPN ingestion and independent provider verification: initial creation/pending (J5, charge number 0) is not a successful monthly payment. Verify each real debit, map `RecurringId` to a stored subscription, retain transaction id and charge number, and update access only for the paid calendar period. Deduplicate repeated or out-of-order notifications atomically.
5. Periodically reconcile provider mandate status and charge history. Missing callbacks must not silently grant paid access or create duplicate debits. Production reconciliation must match amount, currency, customer and mandate identity.
6. Implement provider-backed renewal, cancellation/end-date updates, pause/unpause and failure treatment. A local feature toggle or local cancellation status does not stop a mandate already scheduled at Rivhit. Preserve cancellation requests even when the provider is unavailable; show pending confirmation.
7. Decide billing grace period and retry policy after declined payments, notices for failure and upcoming renewal, and whether a price change requires re-consent. Do not independently resubmit a charge when the provider may already retry it.
8. Implement separate initial family credit and full subsequent monthly amount. Support included/excluded/frozen family members, mixed one-off/recurring purchases and changes of payer without creating duplicate mandates.
9. Review agreement wording, cancellation and renewal policies before enabling production. Confirm SMS delivery for a real approved test recipient and receipt-email delivery. Do not convert existing customers automatically.
10. Test creation, initial pending, first/next/last charge, duplicate callbacks, timeout, restarts, price change, family additions, refunds, cancellation and term renewal in TEST. Only then add a separately approved activation switch and complete normal staging/Pages → main deployment gates.

## Official sources checked

- https://rivhit-api.readme.io/docs/recurring-sales
- https://rivhit-api.readme.io/docs/simple-recurring-sale-copy
- https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-geturl
- https://rivhit-api.readme.io/docs/ipn-messages
- https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-recurringsaleupdate

The provider docs differentiate GetUrl creation fields (`RecurringSaleCycle`, `RecurringSaleDay`, `RecurringSaleStep`) from update fields (`RecurringCycle`, `RecurringDay`, `RecurringStep`); do not interchange them. GetUrl documents count 0 for non-stop recurring but its displayed validation range also says 1–999: verify the approved account's behavior in TEST instead of assuming.
