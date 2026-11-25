# Prototype field / flow coverage

This inventory describes the historical standalone fictional prototype. For the current integrated Pages registration/membership flow, see [original-logic integration and release gates](staging-chat-original-logic.md). That flow reuses the original fields and handlers rather than this simplified model. Live DB parity is not yet certified.

Compared with `AuthGateway.tsx`, `UserSettingsModal.tsx`, and `HealthDeclarationForm.tsx` on staging. This is a UX inventory, NOT functional production parity.

| Existing field or action | Prototype |
| --- | --- |
| First / last name | Separate fields, inherited family surname remains editable |
| Birth date / gender | Native date picker, gender choice |
| Phone / OTP | Fake phone and fixed fake code; extra family phone optional |
| Username / email | Per-member fields; valid email format, fictional data recommended; local duplicate checks at save |
| Password | Password + repeat; plaintext ephemeral; salted PBKDF2 verifier saved for explicit local demo login |
| Health questionnaire | All 13 topics displayed with fictional scenario preset; shortened labels |
| Medical certificate | Simulated PDF selection button, no actual file input/upload |
| Signature / parent details and consent | Explicit fake acknowledgement and read-only dummy identity, no real signatures/ID |
| Joining agreement, terms, privacy, cancellation | Fake acknowledgement and placeholder; existing legal documents remain canonical in old UI |
| PUSH / workout reminders | Optional simulated choices, no device permission request |
| Family name / payment grouping | Family label, combined vs separate fake checkout choices |
| Per-member primary and additional plans | Separate choices, defaults none, standalone personal + pair allowed |
| Renewal / change / extras | Account hub per member; extras do not alter existing primary plan |
| Add family member after registration | Entire per-member question sequence; checkout only new member |
| Cancel / freeze | Target choice and explicit mock request; no real cancellation/date/billing policy execution |
| Profile editing | Same field sequence in existing-account scenario |
| Coupon / summary / return from payment | DEMO10, monthly vs one-time totals, no real checkout |

Not implemented: production accounts/server uniqueness checks, actual health forms/signing, actual OTP, catalog/admin data, real pricing/credits/proration, mandate grouping/sync, real service delivery, free-form card sizes or quantities, and production actions. Packages are fixed fictional examples. Explicit registration save creates unpaid local demo identities only; no server or paid entitlement is changed. Functional production parity needs a separately approved phase after UX review.

Mobile: standalone CSS includes one-column layout, wrapping member cards, two-column management actions (one on very narrow screens), 44px touch targets, 16px text inputs to avoid iOS input zoom, native date/email/tel controls, and safe-area padding. Browser checks should cover 320, 390, 430 and desktop widths before claiming device-wide compatibility; real iOS/Android testing remains separate.

Verified locally on 2026-11-24: credential form and add-on summary at widths 320, 390, 430, and 1280 with no horizontal overflow. Inspected 390px account and credentials screenshots; checked fake OTP, password entry, 13 health topics, minor parent fields, consent/reminder controls, and existing-account family addition. No real phone, credit card or API was used. This is not a real-device certification.

Embedded mobile follow-up (2026-11-24): replaced nested desktop-card margins with edge-to-edge app content below 600px; body/helper text is 14–16px, inputs/actions 16px with 52px height, account actions at least 48px. The demo notice is a collapsed, expandable disclosure that retains the no-charge/SMS warning. Host header respects safe areas and locks/restores both document and body scrolling while the frame is open. Browser measurements verified registration fields, account hub and plan selection at 320/390/430px (plus registration/plans at 1280px), with scrollWidth equal to clientWidth. Local screenshots inspected at 390px. Changes are confined to the gated staging chat; existing home/login styling and production bundle remain unchanged. Actual phone/keyboard testing is still needed.
