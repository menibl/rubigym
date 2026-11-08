# Automatic release of proven undispatched checkout reservations

An authenticated customer retrying payment no longer needs a manager to clear a
standalone recurring reservation which was never sent to Rivhit. The payment
create action releases eligible reservations before checking for existing ones.
The saved-request resume action also releases an eligible reservation and returns
the customer to plan selection, without creating or charging a provider page.
Passive recovery-status reads remain read-only.

Eligibility requires all existing evidence checks, not merely a timeout:

- original owner and original order snapshot match;
- standalone, ungrouped request in RESERVED stage, older than five minutes;
- no requestDispatchedAt and no linked recurring series;
- no encrypted hosted-page capability, linked receipt or local contract;
- compare-and-swap rechecks prevent release if dispatch wins concurrently.

Audit reason: AUTO_RETRY_VERIFIED_NEVER_DISPATCHED. The original reservation is
retained as RELEASED_UNDISPATCHED. Unused reservation coupons are freed through
the existing guarded release helper. Existing memberships/receipts are unchanged.
No SQL migration, provider cancellation, refund, environment switch or scheduled
bulk reset is introduced.

## Important limits

This is not blanket release of abandoned hosted pages. A user who reached the
Rivhit page has already had a GetUrl request sent. An empty SaleDetails response,
no matching recurring instruction, browser Back or elapsed time does not establish
that the old URL is unusable. Those requests retain the original-page continuation
flow and existing verification guards. Legacy/unknown, family-journal and grouped
reservations are deliberately not auto-released by this change. Resolving those
requires original-page continuation or reliable provider invalidation evidence.

Primary references consulted:
- https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-geturl
- https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-saledetails

Those documents distinguish page creation and sale lookup; they do not establish
an atomic unpaid-page invalidation contract. No provider-absence assumption is
used to permit a second page.

Regression tests cover automatic create/resume recovery, passive reads, price and
entitlement preservation, encrypted capabilities, receipts/contracts, foreign
owners, legacy/group/family exclusions and concurrent dispatch. All provider calls
in tests are simulated; no live customer's payment request is reset by tests.
