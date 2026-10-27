# Cancelled occurrences and payment provenance

- `excludedDates` cancels one dated occurrence, not its entire series. The manager calendar already applied this rule; trainee booking lists, next-booking cards, group program selection, server registration merges and check-in now apply the same rule.
- Cancelled reservations remain in history. Existing users may remove their reservation, but stale clients cannot add registrations or waitlist entries to a cancelled record. Cancelled records do not consume the Open Gym daily booking limit or block an active replacement through overlap checks.
- A cancelled Open Gym window cannot be bypassed with the ordinary no-slot Open Gym drop-in option. Ordinary drop-ins outside cancelled windows and staff personal/duo exceptions remain available according to their existing policies.
- Upcoming workout reminders skip cancelled occurrences. No old attendance logs, payments or bookings are deleted or silently refunded by this change.
- Applies to group, personal and duo sessions as well as Open Gym. Fully removed records cannot be reintroduced by a stale trainee save. Cancelled session workout links are unavailable, and cancelled group bookings do not suppress Sunday signup reminders.

## Manual approvals versus money received

An offline access approval records a manager exception, not an amount or a card transaction. Previously, the admin debt button also created a mock payment using a catalog price, and the trainee summary displayed mock payments under “שולם בפועל”.

The summary now separates mock payments into a clearly labelled test-history disclosure, shows manual approval against the current plan, and does not invent a cash amount. Actual historical payments retain their original amount and plan and are explicitly labelled as history, not the current entitlement.

To record a new offline payment, the manager must enter the amount actually received and confirm the trainee and assigned plan. The record has provider `MANUAL`, not a simulated card charge. Missing plan/invalid amount cannot fall back to a 500-shekel group membership. This does not charge Rivhit or create a provider invoice.

No production customer record was edited as part of development. Historical mock records are preserved, not rewritten as cash receipts.

## At-a-glance trainee card

The trainee table's status/payment cell now displays the operational status and recorded expiry in the same cell, with explicit missing-date and manual-override labels. Active status is never labelled as paid merely because staff selected ACTIVE. Freeze/cancellation/expiry take precedence; an offline exception is explicitly an exception, not evidence of cash collection.

For each current primary/additional plan, show the actual matching receipt's amount/date/method/recorded discount, or state that no completed payment was recorded for that plan. A past group purchase does not become an Open Gym payment when the primary plan is changed. Family additional plans are matched against their actual receipt selections; the whole family amount is never presented as the individual member's paid amount. Recorded secondary expiries and card balances are shown without inventing missing values. Pending requests and refunds are distinguished from completed payments; legacy simulated payment-method strings are treated as test records even if isMock was absent.

Historical receipts remain visible as history, not a claim of coverage for the current month. This is a read-only presentation of stored records, not a live Rivhit reconciliation or a reconstruction of undocumented cash.
