# Isolated conversational onboarding prototype

Current integrated flow: see [Staging chat over original logic](staging-chat-original-logic.md). The standalone fictional model, prices and read-only account snapshot described below are retained as historical UX reference; integrated AuthGateway/TraineeDashboard now wrap their original components and use a provider-blocked dry preview.

This is a fictional UX experiment integrated into the existing Pages application, not an alternative payment implementation.

## Integrated navigation (Pages only)

- Existing landing-page registration buttons and `?screen=register` open the chat in an isolated full-screen frame. “Already registered?” closes it into the unchanged AuthGateway login screen.
- Existing trainee membership/payment navigation opens the same embedded chat, initialized with a minimal read-only snapshot of the current demo account/family, plan labels, per-plan expiry and recorded membership status. No live account is created or changed.
- Home, login, workouts, profile and management screens remain the existing components. The separate preview banner has been removed.
- Prototype styles stay inside the frame; they do not theme or reset the host app.
- Frame CSP sets `connect-src 'none'` and `form-action 'none'`; sandbox allows only scripts, same-origin storage and demo confirmation dialogs. No popups, forms or top navigation. Membership management remains read-only; the explicit registration-save callback can create local demo identities only, never payments.
- Parent/child initialization checks exact origin, window identity and message type; only the first initialization is accepted. Registration save sends the fictional draft and salted password verifiers to the same-origin parent. Plaintext passwords, provider tokens and payment references never cross the bridge.
- Draft keys are separated by registration vs account and by a fingerprint of the displayed snapshot. Returning to the chat resumes that draft; changed source membership snapshots start a fresh scoped draft. Original standalone drafts remain separate.
- Existing hosted checkout-return reconciliation is skipped in these Pages experiment components, never in production. The normal login stays unchanged (Pages login uses its existing fake OTP implementation).

Local integrated preview: build Pages with public demo build settings, then open the existing app at `/rubigym/` (not the standalone prototype HTML). Demo manager login is the existing prefilled login. To inspect a trainee, use a seeded demo trainee's phone and the existing demo OTP shown in the UI. Do not use real credentials or request real SMS.

## Integrated form regression and login clarity

The first embedded release blocked native form submission through its sandbox. That also prevented React `onSubmit` from advancing questions (and applying coupons). All prototype form containers are now explicit UI groups with `type=button` actions and Enter-key handling. The sandbox and CSP remain restrictive; no `allow-forms` permission or network permission was added. Tests reject native forms/submit buttons in the chat.

The Pages demo has no production accounts. Previously an unknown phone automatically switched login into registration. In this experiment, it now stays on login with an explicit demo-only message. A seeded-trainee fill button offers `0541111111`; the existing Pages OTP is `1111`, not a real SMS. Live login behavior is unchanged.

Browser regression on 2026-11-24 (embedded, not standalone): reproduced both original failures on published staging; then tested the repaired local Pages build through adult name/date/gender/phone/OTP/credentials, medical-pending simulation, terms, primary/addons, second family member with optional blank phone and minor parent acknowledgement, standalone personal+pair packages, combined summary, coupon, payment return, reload/resume and simulated completion. Verified unknown demo phone stays on login, seeded trainee login, and membership renewal/change/cancel/freeze simulations. No real account, SMS or provider request was created.

- Only `pnpm run build:pages` emits `conversation-prototype.html` and its entry.
- `pnpm run build` (production) does not include the prototype entry or its assets. The legacy entry's Pages-only link is compiled out.
- The entry additionally permits only the repository's Pages hostname (`menibl.github.io`) and local preview hosts. Moving Pages files onto the production hostname does not enable it.
- The legacy Pages application remains at `index.html`; production registration, payment, SMS and backend behavior are unchanged.
- No API requests, production accounts, real checkout, SMS, medical files or signatures are used by the prototype. All pricing is explicitly fictional. Fonts may load from Google Fonts.
- Drafts use scoped `baly-conversation-fictional-v1` keys. Explicit completed registration save additionally writes to the existing local Pages demo account/session stores. Enter fictional data only. Browser storage clearing or another device will not recover these records. Storage errors are surfaced.
- Try individual registration, family registration, standalone personal + pair services, demo renewal, cancellation preview, coupon `DEMO10`, reload during a family member's birthday step, and leaving/re-entering simulated payment.
- The expanded prototype adds a registered-account hub, per-member update/addon/renew/cancel/freeze/profile actions, family addition after registration, username/email and ephemeral password fields, OTP simulation, gender, health topic inventory/parent mock fields, and consent/notification choices. See [field coverage](conversation-field-coverage.md) for explicit prototype limitations.
- Existing local drafts are preserved. To inspect the whole expanded registration, use the reset-draft control and choose a new scenario. Never enter real passwords or identity/medical data.
- Incomplete real payments and existing mandates are NOT modified by this experiment. Billing grouping is illustrative only, assuming identical periods and terms.

## Saving a local demo account and returning home

Completing the simulated checkout alone is not account creation. The final registration screen now offers an explicit save-and-enter button. It creates local trainee identities (including family members), logs in the head, clears registration URL parameters and returns to the existing trainee home. The normal Pages root opens the existing login, not registration; explicit `?surface=landing` still opens the marketing landing. Logout and subsequent password/phone login return to the existing home without automatically opening the chat or the unpaid-access modal for these newly created demo identities.

Passwords are converted to randomly salted PBKDF2-SHA256 verifiers (120,000 iterations). Only verifiers are persisted in the scoped staging draft and existing demo password store, never plaintext. Save retries use a stable registration ID to avoid duplicate identities; existing usernames/phones/emails are checked locally. No live identity check is made. Older completed mock drafts did not create an account: re-enter any missing demo password when prompted, or restart, then explicitly save.

The account is available only in the same browser/origin/device. Use the chosen username and demo password, or its phone with the existing Pages fake OTP `1111`. No SMS is sent. The simulated checkout grants no paid status, expiry, credits, medical approval or genuine signatures: records remain unpaid and health/club signatures remain false. Account-management chat actions still do not mutate these records.

Browser regression on 2026-11-24: completed and saved a fictional account, verified the existing home, logout, chosen username/password login, phone/fake-OTP login and persisted session after reload. Production build excludes prototype artifacts and the save UI.

## Review and release

Feature PR goes to staging for human review. No production activation is authorized by this experiment. Continue legacy fixes on new feature branches from latest staging. The independent Pages entry and compile-time gate keep experimental UI out of production promotions of those fixes. Do not connect real services or remove the production gate without a separately approved implementation and safety review.

## Local visual preview

Run `pnpm run build:pages`, then `pnpm exec vite preview --host 127.0.0.1 --port 4174 --base=/rubigym/`. Open `/rubigym/conversation-prototype.html`. A normal `pnpm run dev` deliberately does not activate this Pages-only experiment.
