# Protected manager release of abandoned recurring requests

Location: Trainees → plan/payment actions → open/stuck payment requests → show existing requests → controlled release.

This is NOT an automatic reset or provider cancellation. The manager must first obtain provider confirmation that no payment/recurring instruction exists for the request and the old hosted page was never created or is unusable. Record a support reference/date and reason; confirm both declarations and enter the current manager login password. Never enter card information, tokens or API keys.

Preview and confirmation separately query the recurring merchant's RecurringSaleList for the beneficiary, signed payer/group participants and family payer phones. Any active instruction, partial/error response, malformed result, missing phone, recorded payment, linked contract, changed request or expired preview prevents release. The preview alone does not prove an old hosted page cannot accept payment. Provider confirmation of its invalidation is a mandatory operator prerequisite, not an API-verified fact.

The 5-minute confirmation HMAC binds manager, club, user, request and identity. The server verifies the manager password (5 attempts/15 minutes per manager/process), rechecks the provider and performs optimistic concurrency checks. A deployment restart resets this in-memory rate limit. Production ingress controls remain recommended.

The request is retained with RELEASED_MANAGER_REVIEW, cancellation time/manager, reason, provider reference and explicit evidence source. Unused coupon reservation is released; users, payments, existing contracts and encrypted continuation audit remain unchanged. No bulk reset, charge, refund or cancellation calls are made. Family split requests are deliberately excluded because their cached checkout needs a separate coordinated replacement flow.

Once released the trainee chooses a plan again. The normal payment confirmation/duplicate guards still apply. This cannot retroactively invalidate a hosted page: operators must not attest invalidation merely because a customer says they did not enter a card. If provider safety cannot be established, do not release.

Provider reference: https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-recurringsalelist ; CancelSale is sale cancellation, not an established safe page-expiry method for requests missing a provider identifier: https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-cancelsale
