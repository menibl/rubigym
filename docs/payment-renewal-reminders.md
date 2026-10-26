# Expired membership payment reminders

## Schedule and eligibility

- Runs on the existing server scheduler, not in the browser. No new cron service is required.
- Israel time: daily from 10:00, with same-day catch-up until 20:00. No overnight or historical catch-up messages.
- A trainee with a valid expired primary membership date receives one private, clearly automated club chat message per calendar day. Existing push delivery is used according to notification preferences; the chat remains available without push.
- SMS is scheduled on expiry-window days 1, 4, 7, 10 and 13. The default window is 14 days inclusive. For exclusive calendar expiry, the expiry date itself is day 1; for inclusive legacy expiry, the next day is day 1.
- A future renewed expiry, incomplete registration, effective cancellation, current freeze, or the manager's “לא משלם — הפסקת תזכורות תשלום” setting suppresses reminders. No expiry means no invented start date and no reminder.
- Family member reminders go to the linked responsible payer, combined into one daily message. Frozen/skipped/not-started selections are excluded. The payer's exemption/freeze also suppresses family reminders.
- A family's different expiry dates cannot cause more than one SMS within three days. A shared phone receives at most one reminder SMS per day.

## Management

Trainees → “פעולות מסלול, תשלום ומחיקה” → “תזכורות לחידוש מנוי”. Managers can mark a trainee as not paying (stop reminders), undo that setting, or extend reminders by one week, 30 days, or through a chosen date inclusive. Extensions are bound to the current expiry and do not carry into the next paid cycle. The default fortnight cannot be shortened by an extension.

These controls never clear a debt, record a payment, grant access, or cancel a provider recurring contract. For a free membership, configure the access expiry separately. For members already expired more than 14 days when deployed, no reminders are sent unless a manager extends them.

## Delivery safety and operations

- Existing Pulseem configuration is reused; never put credentials into source or browser configuration. Without configured SMS service, app messages still work.
- Optional server kill switch: `PAYMENT_REMINDERS_ENABLED=false` stops this feature's app and SMS reminders without affecting OTP or workout reminders. The feature is enabled by default; no new environment setting is needed.
- Daily message IDs plus revision-based CAS prevent repeated messages on overlapping workers/restarts. SMS uses existing PostgreSQL delivery claims and a stable provider reference.
- SMS claims are not released after ambiguous timeouts: the provider may have accepted the send. No automatic retry that could spam users. The next scheduled SMS slot remains available.
- `membershipReminderDeliveries` stores bounded SMS audit metadata (accepted or failed/unknown), not raw phone numbers, provider bodies, credentials or message text. It is server-owned, preserved against stale state saves, and excluded from trainee payloads.
- `ACCEPTED` is provider acceptance, not proof of handset delivery. The safe log prefix is `Membership payment reminder SMS`.
- No new database schema. Existing fields are optional; previous app images can still read the payload.
- Automated tests use fake SMS transports only. No real customer SMS or financial charge is sent by tests.

Example: expiry 2026-11-01 exclusive gives app messages November 1–14 and SMS on November 1/4/7/10/13. A payment extending expiry to December 1 stops November messages. A manager extension to November 30 allows later daily messages and retains the three-day SMS cadence, without backfilling missed days.
