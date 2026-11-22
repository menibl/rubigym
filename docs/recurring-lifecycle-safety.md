# Recurring lifecycle: implementation scope and provider prerequisites

## Part 1: existing-series customer names (implemented)

- The server worker starts on process startup and checks a bounded batch every minute.
- It groups existing instructions by provider series UUID, not by beneficiary.
- It requires a persisted original payer/order binding and corroborating provider phone. Shared family name/email alone never establishes ownership.
- It reads current provider names, changes only `CustomerFirstName` and `CustomerLastName` when needed, then reads again before recording success.
- It keeps the original family payer on combined instructions; beneficiary names must not replace the payer's invoice identity.
- A dedicated connection-scoped PostgreSQL advisory lock prevents overlapping workers for a series. Lost update responses are resolved by another read, not blind replay.
- The exported provider adapter permits only details lookup and customer-name update, with a field allowlist. It cannot create pages, charge a card, change amount/token/schedule, cancel a series, or modify issued documents.
- Matching names are rechecked daily, profile name changes are picked up on the next batch, and uncertain results back off 15 minutes. Review/retry/success status appears in recurring finance status.
- Legacy instructions without a verified saved payer binding are shown as requiring manager review, never guessed.
- A provider first name belonging to a different person is not overwritten merely because the phone matches. An explicit invoice-payer transfer needs a separately approved, server-owned assignment; changing the original payer's own profile name to the new payer's name is not a transfer.

Provider contract: [RecurringSaleUpdateCustomer](https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-recurringsaleupdatecustomer). Provider first/last-name limits are 20/30 characters.

## Part 2: cancellation and freeze (not implemented or enabled in this change)

The requested freeze policy is one deferred payment plus one extra coverage month, retaining each member's original payment count. Family members who did not freeze must retain their own dates and total charges. Annual cancellation retains the notice period; an app request must not cancel the entire family series.

The current application verifier assumes constant signed series amounts and 12 monthly charges. Changing a family amount without a versioned, member-scoped billing journal would make real receipts fail verification or attribute incorrect amounts. This verifier must not be relaxed to accept arbitrary mismatches.

The documented [RecurringSaleUpdate](https://icredit.rivhit.co.il/API/PaymentPageRequest.svc/help/operations/RecurringSaleUpdate) request supports activation, automatic charging, end date and relative schedule offset. It does not expose a payment-count update field. [RecurringSaleDetails](https://icredit.rivhit.co.il/API/PaymentPageRequest.svc/help/operations/RecurringSaleDetails) exposes a count, but that does not establish a supported way to change it.

Before automating a partial-family freeze, obtain iCredit confirmation and a sandbox-tested contract for:

1. Retaining the unaffected members' last debit and coverage dates while collecting the frozen member's deferred final payment after the original series has exhausted its 12 charges.
2. Whether count can be amended through a supported endpoint, and the read-back evidence proving the resulting remaining charges.
3. How to make a relative offset retry-safe after a timeout and distinguish an already-applied offset from an unexecuted one.
4. Whether modifying items or end date can cause an immediate debit, and whether restoration requires a new customer-authorized series.

No automatic money/schedule changes are implemented in part 1. Do not create a replacement series, copy tokens, cancel a shared series, or increase the count on an assumption. If provider support requires splitting the original family instruction, that is a separate customer-authorization and migration workflow, not a retry of the current checkout.

The requested family-payer migration keeps the existing card and series. It must update family ownership and an explicit future invoice-customer assignment while preserving the historical signed payer and receipts, and must not be inferred from a beneficiary's profile edit. This migration is not implemented in part 1.

After provider confirmation the billing implementation also needs a durable per-series command journal, member/plan-scoped effective dates and allocations, compare-before-write/read-back verification, reconciliation against historical amendment versions, visible pending/failure states, and manager alerts. Provider timeouts must never be reported as successful freezes or cancellations.
