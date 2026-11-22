# Recurring lifecycle: implementation scope and provider prerequisites

## Part 1: existing-series customer names (implemented)

- The server worker starts on process startup and checks a bounded batch every minute.
- It groups existing instructions by provider series UUID, not by beneficiary.
- It requires a persisted original payer/order binding and corroborating provider phone. Shared family name/email alone never establishes ownership.
- It reads current provider names, changes only `CustomerFirstName` and `CustomerLastName` when needed, then reads again before recording success.
- By default it keeps the original family payer on combined instructions. A server-approved family transfer may explicitly assign a different invoice customer; beneficiary profile edits cannot change the payer.
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

## Family payer migration (implemented; live operation requires manager confirmation)

The manager opens **החלפת משלם משפחתי וחשבוניות** on the current family head, selects an existing registered family member, and obtains a read-only preview. The preview corroborates original provider ownership and captures digests of card/schedule/amount settings; no raw provider token is sent to the browser or persisted in the audit. A signed, manager-bound, ten-minute confirmation token protects the preview. Confirmation rechecks the family and provider conditions.

One database transaction updates family-head links and durable login-account profiles, stores an immutable approval audit and explicit invoice-customer assignments, and queues name-only synchronization. Passwords, usernames, sessions, individual plans/status/expiry/credits/signatures, existing receipts and signed provider order snapshots remain unchanged. Repeating the same confirmation returns its existing result. Missing accounts or write failures roll back the transaction.

The approval is also stored in the additive `family_payer_transfer_audit` SQL table. Older images do not need or modify this table; the new image can recover its audit/assignments even if a rollback image later omitted new JSON fields. Recovery never invents a payment, restores a cancelled instruction, or changes membership entitlement. Missing/inconsistent current family ownership is reported for review. Ordinary state/billing saves protect the transferred head; only the explicit transfer transaction changes it.

The worker uses the original payer's phone to corroborate the SAME instruction, applies the approved new customer's full name, and verifies both the resulting name and unchanged financial/card settings. It can neither create a series nor charge/refund/cancel/change a card or amount. Provider email/phone are not changed by this name-only operation; invoice delivery destinations require separate handling. App family management moves first; provider invoice names are visibly PENDING until read-back succeeds. Failures do not claim successful provider synchronization and are retried/surfaced for review. The existing family-capacity count is copied to the new head, not reduced to the number of currently registered profiles.

Old manager-tab saves cannot restore the former head or erase the server-owned approval. The former head loses family-management rights; normal access for all existing family members remains. Read-only reconciliation retains the audited original provider ownership after transfer rather than requiring the new head's phone to match the original instruction. Historical signed payers and receipts are intentionally not rewritten.

Open unverified payment pages, cross-family/shared-series ambiguity, invalid names and unverifiable provider ownership block the transfer rather than cancelling or replacing instructions. There is no card-update input. This is a change of family management and future invoice names, NOT a new mandate or a transfer of historical financial liability.

After provider confirmation the billing implementation also needs a durable per-series command journal, member/plan-scoped effective dates and allocations, compare-before-write/read-back verification, reconciliation against historical amendment versions, visible pending/failure states, and manager alerts. Provider timeouts must never be reported as successful freezes or cancellations.
