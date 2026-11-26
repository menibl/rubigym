# Staging family plan tiles

Registered family accounts now use a step-by-step tile picker for each member:
participation → primary plan (or add-ons only) → add-ons and session quantities →
member review → complete family summary. The existing billing, coupon and checkout
preview controls appear only after a valid complete family summary is displayed.

Each tile advances to the next step. Back navigation and summary edit actions keep
the controlled family selection draft. Removing a selected item only removes it
from this purchase; it does not cancel a membership, detach a member or delete data.
Skipped members remain visible with zero purchase cost. Personal and duo training
can be selected together without buying Open Gym.

This is staging/demo presentation only, behind the existing compile-time and
hostname/demo gates. Production continues to render FamilyPlanConfigurator.
The original FamilyMemberPlanSelection DTO, age/freeze policy, catalog prices,
familyPurchaseAmount and original checkout preview remain authoritative. No new
database fields, provider requests, charges, receipts or SMS are created. Existing
production and registration handlers are unchanged.

Tests cover quantities, member ownership, skipped/frozen selections, invalid and
duplicate plans, draft removal, original quote parity and production exclusion.
