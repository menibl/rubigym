# Back from an unfinished hosted payment page

This patch fixes code-level false blocks, without discarding potentially live provider pages or bypassing payment verification. A production log reason code is still needed to identify which case a particular trainee hit.

## Corrected cases

- SaleDetails WCF defaults: `TransactionStatus: null`, zero GUID `Token`/`RecurringId`, empty card/authorization fields and zero uncharged amount are not evidence that a card was authorized. A response explicitly tied to the original signed order with a real page record and null transaction status can reopen **only the original server-encrypted URL**, without a phone-wide recurring search. Missing/mismatched ownership/order/amount or actual card/receipt evidence is not treated this way.
- The documented `RecurringSales` collection is nillable. An explicit `RecurringSales: null` is accepted as an empty collection for the existing original-page continuation check; a missing key, malformed response, provider error or ambiguous active series is still not a negative result.
- Family journal recovery: a recurring page can exist in encrypted server storage while the family line is left in REVIEW/DISPATCHING without `checkout` (e.g. interrupted journal write after GetUrl succeeded). Retry now resolves the exact batch/item-owned reservation and restores the journal from the original page, instead of leaving the line permanently locked or calling GetUrl again.
- Browser Back/BFCache: trainee, registration and saved-checkout controls reset busy UI on persisted `pageshow` and refresh saved requests. This does not delete payment references, cancel orders, activate subscriptions or infer that payment failed.

## Safety and limits

No blanket cancellation, no cancellation API calls, no repeat GetUrl for a dispatched reservation, no automatic charge, and no activation from visiting a payment page. Proven never-dispatched reservations retain their separate, existing automatic recovery path. Real card/receipt evidence without a verifiable matching series, unknown creation timeouts, missing legacy URL/reference, changed ownership and expired old pages still need provider reconciliation; they cannot safely be turned into a new charge based only on elapsed time or browser Back.

Hosted-page reuse is not a replacement for provider-side duplicate protection. iCredit documents that GetUrl duplicate prevention is enabled in payment-page settings, not via `PreventDuplicates` in the GetUrl request. Existing live pages/instructions were not changed or cancelled by development tests.

## Primary references

- [SaleDetails DTO: nullable transaction fields](https://icredit.rivhit.co.il/API/PaymentPageRequest.svc/help/operations/SaleDetails)
- [RecurringSaleList DTO: nillable collection](https://icredit.rivhit.co.il/API/PaymentPageRequest.svc/help/operations/RecurringSaleList)
- [iCredit duplicate prevention](https://rivhit-api.readme.io/docs/prevent-duplicates-icredit)

Regression tests use synthetic provider responses only. No live payment, customer reset or production deploy is part of this change.
