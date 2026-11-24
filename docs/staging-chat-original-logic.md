# Staging chat over the original application logic

## Release scope and safety

Staging/Pages only. No MAIN promotion is authorized. The integrated registration and membership entry points now use `StagingLogicChat`, not the standalone fictional `Conversation` runtime. The latter is retained as an isolated historical UX reference.

Activation requires both the existing Pages compile/hostname gate and `VITE_APP_MODE=demo`. `clubServer.request` and every provider fetch in `rivhitPayments` reject requests whenever the Pages chat gate is active. A misconfigured demo flag therefore fails closed rather than contacting a live backend. Phone OTP, registration and family changes use the existing Pages demo branches. No real SMS, checkout page, reconciliation, recurring instruction, receipt or paid access is created.

## Original registration fields and actions

`AuthGateway` still owns every field value, the phone/OTP callbacks, identity and age validation, `HealthDeclarationForm`, health-record creation, original user/family DTO construction and `onRegister(unpaidRegistration(...))`. `StagingChatForm` changes only which existing React field/group is displayed and when the next question appears. It does not construct a second user DTO. The final submit calls the original handler. Health launch/questionnaire stay one group, and final submit/back controls stay together.

The real production registration endpoints (`/api/auth/register`, `/api/auth/family-members`) and server/database implementation are unchanged. The integrated Pages experiment uses the same application's demo persistence branch, not a new `demo-chat-*` account mapper. New demo passwords are PBKDF2 verifiers, not plaintext. Existing legacy demo verifiers/passwords remain compatible.

Safe non-secret profile fields and question position may resume from sessionStorage. Passwords, OTPs, verification tokens, health answers, certificates, signatures and consent are not draft fields. On reload, an unfilled password question must be revisited, followed by health/consent where needed. Completed fictional health/user records live in the existing demo account store exactly as the original Pages application does; only test data may be entered.

## Original catalog, selections and payment engine

The membership screen uses the original `TraineeDashboard` handlers, `FamilyPlanConfigurator`, `DiscountCodeField`, active configured catalog, session quantities, existing expiry checks and benefit/user ownership validation. The family summary reuses `HomeMembershipSummary`. Adding family members, cancellation requests and freeze requests use the existing application callbacks against local demo state. The chat menu changes presentation only.

`startRivhitPayment` is intercepted before any provider operation. A dry preview calls the original pure `familySplitLines` and `groupFamilyRecurringLines` engine with the current demo catalog, receipts and selected coupon. It handles individual selections and family selections through the same engine, preserving line allocation, grouping and already-recorded monthly/recurring exclusions. It ignores client-supplied price overrides. Editing a basket clears its previous preview. The preview never saves a payment or grants access.

This is NOT a final provider quotation: live server authorization, credits/upgrade adjustments, current provider status and other state-dependent checks still belong to the unchanged server transaction path. No production readiness claim follows from the dry preview.

## Color and layout

Gold `#c9a867` replaces purple; existing mobile input/button sizes and typography are retained, not the larger illustrative design. Embedded host controls mirror those sizes. Family editor nesting is flattened on narrow screens. Home and login styling remain unchanged. Birth-date inputs additionally forward the native input event into their original controlled state so dates survive question transitions.

## Evidence and remaining release gate

- Frontend contract tests verify untouched original callbacks/field mappings and production passthrough rendering.
- Individual/family quote tests compare results directly with the original server line/grouping functions for normal, percent and fixed discounts, unrelated-member rejection and recorded-payment exclusion.
- The extended original server registration test verifies identity, DOB/gender, health answers/history/signature/certificate fields, club consent and notification fields in the auth profile and canonical club-state persistence boundary. Medical approval remains server-owned and false, and no payment is inserted.
- These server tests use isolated in-memory stores and fake provider fixtures. They are not PostgreSQL integration tests and do not verify a live DB schema or connection.
- Before any MAIN promotion: run a separate isolated PostgreSQL persistence comparison with test-only accounts, full medical/parent/certificate variants and original-vs-chat DTOs; check all renewal/upgrade/family-credit scenarios through server-side mocked-provider tests; obtain UX approval and explicit MAIN approval. No live credentials or production financial actions are needed for those tests.

The public Pages site has no server DB. Do not describe a successful local registration or passing in-memory test as a verified write to production or a staging PostgreSQL database.
