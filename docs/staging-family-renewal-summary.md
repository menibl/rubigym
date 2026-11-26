# Staging renewal price projection

The registered family renewal screen now derives every price, allocated discount
and final amount from the existing read-only `stagingCheckoutQuote`, which calls
the unchanged server `familySplitLines` engine. Per-line, per-member and aggregate
amounts preserve the engine's cents. Percent/fixed discounts are not recalculated
by a second UI algorithm.

The existing expired-only renewal draft still excludes active terms, pending
payments, frozen accounts and ongoing member contracts. When member expiry data
is stale but the engine finds an already-paid monthly receipt or an existing
recurring receipt, that item is displayed as excluded with zero payable amount.
It is also removed from the controlled selection forwarded on confirmation.
Other payable additions and beneficiaries remain intact. Unknown/invalid coupons
or quote errors disable confirmation. No eligible lines means no confirmation.

This is only the staging/demo renewal summary. No server/shared pricing code,
DB schema, live payment, recurrence, membership, receipt, SMS or production path
is modified. Demo calculations do not query Rivhit or verify live DB persistence.
Server-side credits and live provider checks remain release-gate work before any
separately authorized production activation of the chat UI.
