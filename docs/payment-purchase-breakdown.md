# Finance purchase breakdown

Every ledger row has a native expandable purchase-details cell. It displays
beneficiaries, personal/duo purchase quantities (not current remaining balances),
unit/base/net prices, recorded coupon, discounts, prior-payment credit and receipt
total. Test, refunded and pending records retain explicit status warnings.

## Existing transactions

Uses only the receipt's familyMemberPlans/additionalPlans/trainingSessionsCount or
sessionsPurchased and recorded discount/credit fields. Historical prices not
recorded in the receipt show "לא תועד". Never query today's catalog prices,
current balances, current family configuration or current coupon percentages to
invent history. The display is available immediately for existing receipts, but
does not backfill or rewrite them. Plan-name defaults identify categories only.

## New transactions

The server freezes a version-1 purchaseBreakdown inside the signed order at page
creation, based on normalized server pricing, not client-provided breakdowns.
Verified persistence copies it into the receipt; replay may enrich a missing
breakdown only from that original signed order, never recompute at verification.
Grouped checkout retains its already frozen beneficiary/line prices and discount
allocations. Other multi-line discounts stay aggregate unless allocation was
actually captured. Credits are separate from discounts. Fixed-price session packs
use the actual resolved base price rather than multiplying the pack price twice.

A snapshot/receipt total mismatch is flagged for review. No provider request,
refund, charge amount, access entitlement, deduction, or recurring schedule is
changed by the breakdown. Signed-order and JSON receipt additions are optional
and backward compatible; no SQL migration/ENV configuration required. Pending
old pages without a breakdown continue as before and may yield partial history.

Tests cover grouped personal/duo, discounts/credits, family exclusions, pack unit
prices, missing history, mismatches, statuses and signed receipt persistence.
No live customer receipt was changed and no real payment was made for testing.
