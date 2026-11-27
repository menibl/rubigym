# Isolated PostgreSQL parity audit — 2026-11-26

## Result

PASS for the tested scope. A native, temporary PostgreSQL **17.12** cluster ran
on **127.0.0.1:55439** only. No Docker/root operation, production database,
environment file, real account, provider request, SMS or charge was used.

Compared immutable source snapshots:

- MAIN: `fe94a03d7774625009d0f548263bb7431bc5f172`
- staging: `23beb283ef55a2a41c199946f62bcc7e8bc7fa84` (includes PR 353)

The audit created separate empty databases, ran each snapshot's original
`createDatabaseStore` and worker routes, and compared actual SQL profiles,
canonical club state and response values. Six fictional accounts and thirteen
quote/discount scenarios matched. Only generated timestamps and UUIDs were
normalized for cross-run comparison; names, IDs supplied by the fixtures,
birthdates, health fields, family links, selections, counts, money, discounts
and statuses were compared without normalization.

## Verified

- The actual `newUser`, `familyUsers` and `newSubUser` form DTO initializers are
  identical in MAIN and staging (TypeScript AST comparison).
- Server, SQL-store/schema, auth, shared pricing, plan DTOs and original family
  pricing source are unchanged.
- Adult registration, medical-certificate-pending registration and minor/parent
  fields persist in both `auth_accounts.profile` and `club_state.payload`.
- Family registration creates separate accounts; adding another family member
  persists the correct payer/family links and rejects a duplicate.
- Password login and persisted sessions work; no plaintext password is saved in
  a profile, and all six test accounts have non-plaintext password hashes.
- Personal and duo training can be quoted together without a gym subscription.
- Mixed recurring and one-time family plans retain their beneficiaries and
  quantities, with both combined and separate grouping.
- Percentage/fixed discounts match the existing line allocation; invalid and
  used coupons are rejected; quote-only requests do not consume/reserve a
  single-use coupon.
- A current-month paid fixture is excluded as `ALREADY_PAID`.
- Chat preview line prices and totals match the original DB-backed worker's
  quote responses in the eight purchase scenarios (including paid exclusion).
- SQL quote-journal contents match the response. Independent fixture cases
  explicitly complete/reset their previous test-only quote to avoid resuming it.
- Optimistic revisions reject a stale write; closing/recreating the store reads
  the same durable SQL data.
- No real or simulated checkout is dispatched. The only payment row is an
  explicitly inserted fixture, and no membership is activated by these quotes.
- All outbound HTTP/provider functions are blocked; attempt count: **0**.

## Reproduce safely

Requires the repository's installed dev dependencies and a **new disposable**
PostgreSQL 17 cluster listening on loopback, with test role `gymflow_test`.
Do not use an existing application database or production credentials.

```powershell
node --import tsx scripts/audit-db-parity.mjs <readonly-main-worktree> 55439 --isolated-postgres
```

The audit creates uniquely named `gymflow_parity_<timestamp>_main/staging`
databases, never opens a URL from environment configuration, and does not drop
databases or modify the application schema/code. Test databases remain available
for inspection after the local cluster is stopped. The native runtime was
installed outside the repository; no runtime dependency/lockfile was changed.

## Limits / release boundary

This is real PostgreSQL persistence evidence, not a live production DB audit or
a browser-driven end-to-end test. The SQL tests submit fixture DTOs, supplemented
by exact comparisons of the UI's actual DTO builders and pricing previews.
Quote-only paths do not test acquiring cards, provider settlement, recurring
callbacks, medical approval decisions or real SMS. Existing MAIN server tests
cover mocked payment/credit/recovery paths separately. No guarantee is made for
every possible historical production data anomaly.

MAIN and public staging were not changed by this audit. Production activation of
the chat still requires separate human approval and release-gate verification.
