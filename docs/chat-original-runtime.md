# Connected chat staging runtime

## Scope / activation

The chat UI and Pages/demo operation are separate concepts. Plain local production
builds disable chat unless explicitly enabled. The production Compose build
defaults `VITE_CHAT_UI_ENABLED` to `true` after approval of the CSP-safe chat and
mobile/family completion fixes. An explicit `false` build override keeps the
legacy interface; the user-facing `ui=legacy` switch remains available when chat
is enabled. Pages staging chat remains independent for continued development.
This is a build-time setting: restarting or redeploying an already cached image
does not change its UI. Promote through staging/main and verify the new release
SHA and served assets before declaring chat activated.

`build:pages` keeps its existing provider/server fences
and fictional local data. The additional **build:chat-test** target enables chat
over the original API only for a loopback browser, a same-origin HTTP API and
non-demo app mode. It is not a production activation switch.

`ui=legacy` reloads into the original interface; `ui=chat` restores the chat.
Both use the same authenticated account, SQL state, server quotes, saved checkout
and original payment continuation. The switch does not migrate/copy profiles,
clear cookies or reset billing requests. Entering the old view during an unsaved
form can lose in-memory edits; existing server partial registrations and saved
payment requests remain intact.

## Authoritative operations

- Original registration/phone/health/family DTO builders and handlers are reused.
- Connected family renewal, family edits and individual purchases obtain their
  final per-beneficiary price/discount/amount from the original authenticated
  `/api/payments/rivhit/create` **quoteOnly** route. No demo receipt filtering or
  local discount algorithm determines the connected confirmation amount.
- Quotes account for real-vs-test receipt classification, pending recurring
  requests and existing saved batches through unchanged server logic. The server
  may return a previous incomplete batch; the UI displays that actual batch,
  rather than claiming new selections have already replaced it.
- Stale quote responses are aborted/ignored; confirm is disabled while loading,
  on errors, while confirming, or when no READY line exists. Direct Enter submit
  cannot bypass the connected individual review.
- If selected types/quantities differ from a saved batch, confirmation is blocked.
  A deliberate refresh uses the original cancel-undispatched-quote endpoint and
  requotes; the server rejects refresh when dispatch has already started. This
  never cancels a provider instruction or an already-paid purchase.
- Confirmation and return-from-payment use the original start/continuation and
  verification functions. The Pages-only return suppression is not applied to
  the connected runtime.
- Freeze delegates to the original request handler. Cancellation and family
  detach do not show fake success in connected mode: they explicitly lead back
  to the original interface/manager workflow. No new cancellation or recurring
  billing implementation is introduced.

## Production security and mobile presentation

Connected chat styles are imported by `src/main.tsx` as static, scoped CSS in
`src/prototype/connected-chat.css`. The shell, family cards, plan tiles and final
actions must not inject `<style>` elements: production's unchanged `style-src`
policy intentionally forbids them. Do not add `unsafe-inline` to work around a
presentation regression. Enabling chat never requires weakening the policy.

For mobile browser QA against the original handlers with fake providers, first
build `pnpm run build:chat-test`, then run the isolated server below with the
additional `--production-csp` argument. It copies the exact policy from
`deploy/Caddyfile` into response headers; this includes the original script,
style, font and form restrictions. Use browser mobile emulation (including 320px
and 400px widths) and check Console for CSP violations. No real accounts,
provider operations or SMS should be used. A 401 session probe before login is
expected and is not a stylesheet failure.

```powershell
node scripts/test-chat-original-runtime.mjs 55439 --isolated-postgres --serve --production-csp
```

## Isolated test runtime

No production DB, credentials or environment file is used. The native disposable
PostgreSQL cluster is local; HTTP binds to 127.0.0.1. Provider operations are
injected fixture responses and OTP is `SMS_TEST_MODE` 1111. Browser checkout
navigation is rewritten to a same-origin `__mock_checkout` page; external provider
navigation is never performed in the isolated test runtime. Production connected
chat keeps the original real provider navigation; it does not use these fixtures.
The test server blocks
outbound fetch. No schedulers from node-entry are started.

## Reproduce

Start a disposable local PostgreSQL 17 test cluster (role `gymflow_test`, port
55439), never an existing application DB. The protocol-level test creates a new
uniquely named database and exits with its HTTP server and SQL pool closed:

```powershell
node scripts/test-chat-original-runtime.mjs 55439 --isolated-postgres
```

For optional browser QA, build and serve the same isolated fixture app:

```powershell
$env:VITE_APP_MODE='server'
$env:VITE_API_URL='http://127.0.0.1:55440'
$env:VITE_PAYMENT_API_URL='http://127.0.0.1:55440'
pnpm run build:chat-test
node scripts/test-chat-original-runtime.mjs 55439 --isolated-postgres --serve
```

Open `http://127.0.0.1:55440/?screen=register`. Use fictional names/phones/emails,
OTP 1111 and fictional declarations only. The fake checkout has no card fields.
Ctrl+C closes the fixture server. Test databases remain local for inspection.

## Verification / remaining gate

The connected protocol test executes the bundled **actual client API modules**
with a simulated window/storage/cookie jar through real HTTP into the original
worker backed by PostgreSQL. It covers OTP/registration, login, family addition,
combined recurring/one-off quote/discounts, saved checkout resume without another
GetUrl, zero-charge recurring setup, personal/duo balances on the beneficiary and
duplicate verification without duplicate receipts. All gateway responses are
fake; HTTP is restricted to the isolated server.

CI runs this same test against an ephemeral PostgreSQL 17 service with a
fixture-only role bound to runner loopback. No deployment credentials are used.

This is not a browser DOM/visual end-to-end test. Browser access was unavailable
in this chat, so mobile interaction and browser cookie/navigation behavior remain
an explicit release gate. No MAIN promotion or live chat activation is authorized.
The public Pages deployment remains the safe local-data demo, not this loopback
DB runtime. Further production enablement requires a separate approved release.

## Completion action emphasis

Chat completion actions use green `#176b50` with white labels, a mint border and
a visible keyboard focus ring. Final member-choice tiles also use a check icon.
Navigation and plan selection keep the original gold/dark treatment. Fonts,
control dimensions, callbacks, validation and disabled states are unchanged.
The color's white-text contrast exceeds WCAG AA 4.5:1. Rules are scoped to the
chat container, and phone/OTP navigation submits are not marked as completion.

The Pages demo still stops at a no-charge preview. The connected isolated runtime
still completes against its fake provider via the original API. This presentation
change modifies neither mode's payment path; the normal production build excludes
the chat completion styles, and does not automatically enable the chat.
