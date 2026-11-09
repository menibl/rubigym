# Trainee list dates

The personal-details cell shows registration date, then health-declaration expiry.
The same semantic date summary appears in the existing responsive trainee cards.

- Registration uses the earliest valid recorded registrationVerifiedAt or
  registrationCompletedAt. No payment, subscription start, signature or account
  recovery/import timestamp is substituted for an unknown joining date.
- New family registrations now store a server-generated completion date in both
  club state and durable account profiles. Existing registration verification and
  completion dates survive completing an existing registration again.
- Missing historical dates show "לא תועד". No speculative backfill is performed.
- Health expiry is one UTC calendar year after the current healthDeclarationDate,
  matching existing server check-in/personal-booking validation. An unsigned or
  invalid-dated declaration is not presented as valid. Expiry and pending medical
  approval have explicit text, not color alone. Dates display in Jerusalem time.

This change displays existing annual policy; it does not change booking gates,
send reminders, edit existing declarations, renew them, or make legal compliance
claims. No database migration or environment configuration is needed.

Coverage includes server-generated family registration timestamps, preserving
original phone verification, SSR date ordering, missing/invalid dates, Jerusalem
timezone, expired/medical-pending text and leap-year behavior. Browser visual QA
and real production records have not been inspected for this change.
