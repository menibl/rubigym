# Bulk recovery of today's recurring instructions

Manager only: Finance → “סנכרון מרוכז — הוראות קבע שנפתחו היום”. Run a read-only preview, review matches/exceptions, then explicitly apply only verified matches. No new page, charge, refund, cancellation or fabricated receipt is created.

The server chooses today's Jerusalem date; the client cannot expand the window. It searches RecurringSaleList using the configured recurring merchant page and the original beneficiary/payer phones, never name/email matching. It retrieves Details and reuses strict single-series verification (original app order, owner phone, merchant IPN URL, exact discounted amount, creation day, start/end/12-month cadence, active automatic instruction). Valid original snapshots remain required for this bulk workflow. Existing single-ID manager recovery remains available for older orders without snapshots.

Only one matching instruction per order is eligible; the same instruction matching independent app orders is an exception. Provider Details must also contain a card token or approval number plus card metadata (server-memory only, never returned/logged). Partial searches, provider failures and ambiguous results never become implied approval. Approved zero-charge setup may activate pending access despite temporarily unavailable history; positive-charge receipt history must be complete and verified. Shared signed family groups are one order, not guessed independent beneficiaries.

Preview is read-only and returns no provider bodies/card fields/tokens or phone numbers. A 10-minute scoped confirmation HMAC binds manager, club, date and normalized results. Confirmation re-fetches provider results and checks again before each write; changed data requires a new preview. Per-contract manager/time audit, existing receipt/event deduplication and a result per order support safe retries. Partial application is reported for review rather than claimed successful.

Access opens as PENDING_FIRST_CHARGE, not PAID. Actual receipts alone enter revenue. Existing daily reconciliation then follows the linked recurring ID. A newly approved plan replaces an expired primary plan, but preserves an unrelated still-current primary entitlement. Cancelled checkouts cannot reopen through a delayed setup event.

Limits: 50 app requests per run, at most 100 returned series per phone and 200 fetched series details, sequential provider requests, 10-second individual request timeout and 60-second discovery request budget. Limit/error cases remain review items. No automatic background bulk discovery is enabled: this manager-operated one-time repair does not change normal charging or schedule contracts.

This does NOT remove legacy 550/600 price fallbacks; that remains a separate pricing correction. It preserves the amount already agreed in each original saved order.

Official provider methods: https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-recurringsalelist and https://rivhit-api.readme.io/reference/post_api-paymentpagerequest-svc-recurringsaledetails
