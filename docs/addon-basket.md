# Additional-service basket

The authenticated additional-service checkout can select personal and duo
sessions together, with an independent quantity for each. It uses the existing
server-priced basket journal and groups the one-off lines into one hosted page.
No Open Gym subscription or family account is required.

All lines of an ADDON basket are signed as ADDON, including the first line.
Verified payment adds each session balance once and leaves primary membership
type, status and expiry untouched. Page creation alone grants no entitlement.
Primary-category plans cannot be submitted as an ADDON basket. Existing pending
checkout protections, discounts and provider-verification rules remain in place.
No database migration or environment change is required.

Regression coverage uses a simulated provider: six personal plus four duo
sessions, catalog prices, discount, one page, one receipt, replay safety, existing
primary plan preservation, and no-primary purchase. UI tests check wiring only;
they do not establish visual or live-provider correctness.

Staging acceptance: choose personal from additional services, select duo, set
different quantities, confirm one manual checkout, and verify both balances and
the unchanged primary membership after approval. Repeat without a gym membership.
Use only a configured test provider; do not charge a real trainee for testing.
