# Isolated conversational onboarding prototype

This is a fictional UX experiment, not an alternative payment implementation.

- Only `pnpm run build:pages` emits `conversation-prototype.html` and its entry.
- `pnpm run build` (production) does not include the prototype entry or its assets. The legacy entry's Pages-only link is compiled out.
- The entry additionally permits only the repository's Pages hostname (`menibl.github.io`) and local preview hosts. Moving Pages files onto the production hostname does not enable it.
- The legacy Pages application remains at `index.html`; its registration, payment, SMS, backend and state code are unchanged.
- No API requests, accounts, real checkout, SMS, medical files or signatures are used by the prototype. All pricing is explicitly fictional. Fonts may load from Google Fonts.
- Drafts use only the separate `baly-conversation-fictional-v1` localStorage key, not the application's stores. Enter fictional data only. Browser storage clearing or another device will not recover this draft. Storage errors are surfaced.
- Try individual registration, family registration, standalone personal + pair services, demo renewal, cancellation preview, coupon `DEMO10`, reload during a family member's birthday step, and leaving/re-entering simulated payment.
- Incomplete real payments and existing mandates are NOT modified by this experiment. Billing grouping is illustrative only, assuming identical periods and terms.

## Review and release

Feature PR goes to staging for human review. No production activation is authorized by this experiment. Continue legacy fixes on new feature branches from latest staging. The independent Pages entry and compile-time gate keep experimental UI out of production promotions of those fixes. Do not connect real services or remove the production gate without a separately approved implementation and safety review.

## Local visual preview

Run `pnpm run build:pages`, then `pnpm exec vite preview --host 127.0.0.1 --port 4174 --base=/rubigym/`. Open `/rubigym/conversation-prototype.html`. A normal `pnpm run dev` deliberately does not activate this Pages-only experiment.
