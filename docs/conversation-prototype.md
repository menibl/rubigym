# Isolated conversational onboarding prototype

This is a fictional UX experiment integrated into the existing Pages application, not an alternative payment implementation.

## Integrated navigation (Pages only)

- Existing landing-page registration buttons and `?screen=register` open the chat in an isolated full-screen frame. “Already registered?” closes it into the unchanged AuthGateway login screen.
- Existing trainee membership/payment navigation opens the same embedded chat, initialized with a minimal read-only snapshot of the current demo account/family, plan labels, per-plan expiry and recorded membership status. No live account is created or changed.
- Home, login, workouts, profile and management screens remain the existing components. The separate preview banner has been removed.
- Prototype styles stay inside the frame; they do not theme or reset the host app.
- Frame CSP sets `connect-src 'none'` and `form-action 'none'`; sandbox allows only scripts, same-origin storage and demo confirmation dialogs. No popups, forms or top navigation. No callbacks can update accounts/payments.
- Parent/child initialization checks exact origin, window identity and message type; only the first initialization is accepted. No user objects, passwords, phone, medical records, provider tokens or payment references cross the bridge.
- Draft keys are separated by registration vs account and by a fingerprint of the displayed snapshot. Returning to the chat resumes that draft; changed source membership snapshots start a fresh scoped draft. Original standalone drafts remain separate.
- Existing hosted checkout-return reconciliation is skipped in these Pages experiment components, never in production. The normal login stays unchanged (Pages login uses its existing fake OTP implementation).

Local integrated preview: build Pages with public demo build settings, then open the existing app at `/rubigym/` (not the standalone prototype HTML). Demo manager login is the existing prefilled login. To inspect a trainee, use a seeded demo trainee's phone and the existing demo OTP shown in the UI. Do not use real credentials or request real SMS.

- Only `pnpm run build:pages` emits `conversation-prototype.html` and its entry.
- `pnpm run build` (production) does not include the prototype entry or its assets. The legacy entry's Pages-only link is compiled out.
- The entry additionally permits only the repository's Pages hostname (`menibl.github.io`) and local preview hosts. Moving Pages files onto the production hostname does not enable it.
- The legacy Pages application remains at `index.html`; its registration, payment, SMS, backend and state code are unchanged.
- No API requests, accounts, real checkout, SMS, medical files or signatures are used by the prototype. All pricing is explicitly fictional. Fonts may load from Google Fonts.
- Drafts use only the separate `baly-conversation-fictional-v1` localStorage key, not the application's stores. Enter fictional data only. Browser storage clearing or another device will not recover this draft. Storage errors are surfaced.
- Try individual registration, family registration, standalone personal + pair services, demo renewal, cancellation preview, coupon `DEMO10`, reload during a family member's birthday step, and leaving/re-entering simulated payment.
- The expanded prototype adds a registered-account hub, per-member update/addon/renew/cancel/freeze/profile actions, family addition after registration, username/email and ephemeral password fields, OTP simulation, gender, health topic inventory/parent mock fields, and consent/notification choices. See [field coverage](conversation-field-coverage.md) for explicit prototype limitations.
- Existing local drafts are preserved. To inspect the whole expanded registration, use the reset-draft control and choose a new scenario. Never enter real passwords or identity/medical data.
- Incomplete real payments and existing mandates are NOT modified by this experiment. Billing grouping is illustrative only, assuming identical periods and terms.

## Review and release

Feature PR goes to staging for human review. No production activation is authorized by this experiment. Continue legacy fixes on new feature branches from latest staging. The independent Pages entry and compile-time gate keep experimental UI out of production promotions of those fixes. Do not connect real services or remove the production gate without a separately approved implementation and safety review.

## Local visual preview

Run `pnpm run build:pages`, then `pnpm exec vite preview --host 127.0.0.1 --port 4174 --base=/rubigym/`. Open `/rubigym/conversation-prototype.html`. A normal `pnpm run dev` deliberately does not activate this Pages-only experiment.
