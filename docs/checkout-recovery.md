# Customer checkout recovery

## Behaviour

- Membership/payment screen lists server-owned unfinished recurring checkouts and the payer's unfinished family/combined checkout. It does not depend on the original browser tab/sessionStorage. Demo/Pages-local accounts do not query the production payment API through this panel.
- Resume of a recurring order uses an authenticated, read/verify-only endpoint, the encrypted original hosted URL and the original signed amount/discount/return origin. It cannot call GetUrl or accept a client-provided URL, price or owner ID. Completed instructions are synchronized rather than reopened.
- Missing page details still require a complete provider search. Already verified, locally bound instructions belonging to the same payer and disjoint purchases no longer cause a blanket phone-based block. Unknown series, overlapping group/Open entitlements, malformed/partial results or conflicting evidence remain blocked. An approved setup with lagging page details can be recovered by the existing strict setup-discovery checks, never from a page visit alone.
- Temporary resume verification has three bounded retries. No create, charge, cancel or family-next dispatch is automatically retried. The page stays saved when verification is unavailable.
- Customer restart is available only for an authenticated, standalone, server-recorded RESERVED request older than five minutes, with no dispatch timestamp, provider capability, linked contract or payment. Existing revision/CAS guards ensure a concurrent dispatch prevents release. This releases no provider transaction and records the user as the actor. Family/mixed/group requests and legacy/possibly dispatched pages cannot use this reset.

## Intentionally not automated

An empty provider lookup, closing a tab, a failure redirect or passage of time is not proof an old hosted page can no longer charge. Once a page has been sent to Rivhit, the safe default is to continue that original page, not to generate another one. Editing those frozen choices still requires safe provider-side invalidation/review if another payable page might remain live. Existing account/price/order/origin/age/anti-duplicate protections remain in place.

No automatic CancelSale or recurring cancellation is introduced. Rivhit documents CancelSale as sale cancellation/refund, not an atomic expire-unpaid-page operation that can safely race with a customer submitting a card. Do not infer safe invalidation from HTTP 200 or a negative list alone.

Primary references reviewed:

- https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-saledetails
- https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-recurringsalelist
- https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-recurringsaledetails
- https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-geturl
- https://rivhit-api.readme.io/docs/refunds

## Acceptance on staging

1. Begin a test recurring checkout, return without entering a card, close the tab, log in again: the recovery panel must resume the exact same provider URL. No extra GetUrl, payment or entitlement should be recorded.
2. Repeat from another browser/device on the same app origin. A different account must not see or resume it. Original production/Pages return-origin guards remain enforced.
3. Repeat for a family payer: existing settled items are not charged again and recovery continues the existing batch. A beneficiary cannot access the payer's batch.
4. Simulate temporary provider failure, missing/malformed details and an unknown active series: bounded read-only retries, preserved request, no new hosted page and no automatic approval.
5. With a verified disjoint instruction for another beneficiary, incomplete original-page details plus the full provider list should allow continuation, not a blanket phone-based denial.
6. A proven never-dispatched standalone request can be reset explicitly. A page already issued, legacy unknown, linked payment/contract or concurrent dispatch must prevent reset.

Automated tests cover the above server invariants and frontend wiring/retry budgets. Interactive browser checks are not claimed. No real user/payment or production configuration is modified by this change.
