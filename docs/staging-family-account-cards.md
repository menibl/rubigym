# Staging family account tiles

Staging/Pages/demo only. Do not promote this experiment to MAIN. Real backend requests and payment/SMS provider operations retain the existing staging fences.

## Navigation

Registered families see one tile per linked account with the original read-only membership summary projection, supplemented by explicit per-plan expiry fields. A tile opens that member's plans and action tiles. Edit and additional-purchase tiles use the original `FamilyPlanConfigurator`, open the chosen member directly, and keep other family members out of a single-member purchase. Editing the generated family renewal basket preserves all other selected family members.

The renewal tile prepares a fresh draft from documented expired terms, not from balances or guessed dates. Active terms, pending receipts, active/pending/failed recurring instructions, freezes, cancellations, incomplete/unpaid registrations, unavailable catalog items and age-ineligible plans are excluded. Training quantities require manual selection. Missing/invalid dates are never guessed. A summary and explicit confirmation precede the original `handleFamilyCheckout` and its existing dry quote interception. Prices come from the existing catalog/discount and server line/grouping functions; no receipt, payment, entitlement or term is created by a quote.

## Actions and limitations

- Removing a plan excludes it from the next renewal selection only; it does not cancel paid access or recurring billing.
- Freeze uses the original member-targeted request and confirmation callback in local demo state.
- Cancellation presents policy and a clearly labelled simulation; it does not submit or cancel an instruction. A production-capable per-plan cancellation API is outside this prototype.
- Detaching a family member changes local demo affiliation only after an explicit confirmation. The account, medical history, payment history and membership terms remain intact. The payer cannot detach themself; shared recurring billing blocks detachment and requires manager review. No equivalent production detach API is added.

No database/schema or provider changes. Production receives the original surfaces and no family-tile runtime. These changes are not certification of production financial lifecycle behavior.

## Verification

Pure tests cover expiry boundaries, unknown/invalid dates, exclusions, pending/recurring holds, exact existing-engine renewal totals, personal+duo add-ons for one beneficiary, no mutation, and affiliation-only demo detachment. Source contracts check staging guards and original checkout wiring. Local browser testing verified the mobile account cards, per-member action navigation and opening the chosen member's editor; further browser testing became unavailable in the chat. The complete dry-quote scenarios are verified by automated tests, not claimed as fully browser-verified.
