# Automatic approval follow-up

The hosted-payment return verifies immediately and retries transient/provider-pending results every 15 seconds, up to 12 retries (3 minutes of delay plus bounded network time). Each verification fetch times out after 10 seconds. Navigating away aborts checks; authentication, explicit decline and identity mismatch errors are not retried. After exhaustion, the original pending reference/return parameters remain, with a message not to pay again.

The same read-only retry wrapper covers individual/add-on/registration returns and verification of the returned family split item. It NEVER wraps creation, family-next-item navigation, GetUrl, charges or refunds. Each verified family beneficiary is persisted server-side and billing is refreshed before offering the next item.

Server scheduler wakes each minute. Recent dispatched, unapproved setups are inspected at most once per minute for 10 minutes, then once per 15-minute bucket up to 24 hours. Approved contracts and older requests retain daily reconciliation. Persistent delivery claims deduplicate the same bucket across processes/restarts; a failed early attempt does not consume all later retry buckets. Provider calls are sequential, 15-second bounded, capped to 20 requests and a 45-second start budget per run, with rotating work for fairness.

Existing cryptographic order, amount, identity and provider approval checks remain mandatory. Merely visiting the page or polling never opens access. Verified setup opens pending-first-charge access, not a fabricated paid receipt. Unknown provider state never becomes a card decline. Existing receipt/event deduplication prevents duplicate entitlements/notifications.

Legacy requests without server continuation or a linked recurring ID still require manager recovery; this does not automatically guess their ownership or release stuck payment requests. PR #278 controlled release is a separate feature.
