# Complete trainee membership summary

The manager's summary previously enumerated only `membershipType` and `secondaryMemberships`. A separate paid purchase could disappear from the summary when it was not represented in those profile fields.

The read-only admin projection now lists primary and configured additional plans, and adds distinct receipt-proven purchases with a known unexpired term. Each row carries its own expiry and whether it came from a saved profile term or the original payment terms. The manager's plan badges and payment summary use the same inventory.

Example: an Open Gym receipt from October 28, 2026 remains visible through October 31 (exclusive expiry November 1), alongside a primary three-month workout program expiring January 28, 2027. The Open Gym row never borrows the program's January expiry.

Safety rules:
- No inferred amount or current-catalog term. Non-calendar terms require the original receipt's duration or a saved plan-specific expiry.
- Unknown terms remain unknown for configured plans; they cannot revive old receipt-only purchases.
- Exclude mock, pending, refunded, expired and consumed-credit receipts from discovered additions. Family selections must actually include that member and plan, including additional selections.
- A recurring charge's notification arrival date does not establish its paid-through date; require a saved expiry for that plan.
- Frozen/cancelled plans are explicitly labelled, never presented as active access.
- Does not rewrite user entitlements, dates, payments or history, and does not charge/refund anything. A receipt-derived row is financial evidence, not an automatic access grant or restoration of a deliberately removed plan.
