# Renewal and family purchase UX

- Trainee home displays a prominent expired-primary-membership alert with direct MY_MEMBERSHIP navigation. Approved recurring setup is not falsely reported expired due to an old receipt. Missing expiry is not invented.
- Checkout asks before continuing payment on the same still-current plan; family checkout lists current selected member plans and expiries. Server price/credit/repeat-charge/recurring-series protections remain authoritative.
- Both checkout handlers clear loading after any non-redirect return, including cancelling a saved page or family confirmation. This prevents an inert payment button on the next attempt.
- Fresh family drafts and new rows default to NOT_STARTED, no selected plan and zero new charge. Existing users, paid entitlements, records and recurring contracts are untouched. Excluding a member is not cancellation of their existing recurring instruction.
- Each member has a collapsed summary (name, selected primary/additions, catalog-based cost). Only one editor opens; confirm that editor before moving to another member or payment. Editors retain linked-member validation, freezes, skip/already-paid options, catalog additions and quantities.
- Blank/inactive included plans cannot proceed to checkout. Prices shown remain pre-server-discount/credit estimates. No fixed family discount is introduced.

Verification: unit and SSR tests, typecheck/build. Browser visual/mobile QA could not run because local browser use is disabled in Work settings; review the exact Pages staging deployment visually before approving production.
