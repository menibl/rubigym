# Authenticated legal footer — review notes (2026-11-02)

## Scope

- Keep the existing six canonical documents available in the authenticated application footer, for trainees, coaches and managers. Remove the mobile trainee CSS rule that hid the footer; reserve space above fixed navigation and the safe area.
- Increase link touch targets, retain the dark/high-contrast document styling, trap keyboard focus in the dialog, support Escape and return focus to the opener.
- Clarify annual cancellation notice/payment for the notice period, one consecutive month of freezing per 12 months, safe equipment use and preservation of mandatory rights.
- No payment, cancellation, freeze, recurring-provider, consent-storage or existing-contract mutation is introduced. No new penalty is collected. Reading a policy does not record acceptance.

## Operator/legal review before publication

This is proposed policy wording, not a certification of legal compliance. Have Israeli counsel review the actual membership agreements, cancellation channels, consumer cancellation windows, refunds and special circumstances. Existing contracts are not retroactively changed by displaying new text.

The annual cancellation UI currently records an effective date one calendar month after the request. Freezing requires manager approval and is available again 12 months after the previous freeze. Neither the policy modal nor the existing freeze action changes an instruction at Rivhit. The text explicitly discloses that provider-side billing must be handled separately, particularly for unified family instructions.

The change intentionally does **not** promise immunity from injury claims or waive negligence/safety duties. Payment for the notice period is distinguished from an extra month's penalty, double charging or charging the entire remaining year.

### Public primary-source references consulted

- Consumer Protection Authority, cancellation information: https://www.gov.il/he/pages/nlfeb23?chapterIndex=7
- Consumer Protection Authority, 2014 annual report (gym cancellation reform): https://www.gov.il/BlobFolder/reports/pfta_annual_reports/he/docs_cpfta_AnnualReport2014.pdf
- Knesset, committee account of the gym cancellation reform (2014; legislative history, not a consolidated current statute): https://main.knesset.gov.il/News/PressReleases/Pages/press260214-6.aspx

Some full government documents could not be fetched (403/geo restriction); available indexed excerpts were reviewed. These references are background only, not a full current-law audit. Statutory rights prevail and financial terms need legal review.

## Acceptance checklist

1. Log in as trainee on a phone (including iOS safe area): scroll to the footer, open all six policies; fixed tabs must not cover the links.
2. Repeat on desktop and as coach/manager; business details must use configured settings.
3. Tab into each link, open it, cycle Tab/Shift+Tab within the dialog, press Escape; focus must return to its opener. Check scrolling long policies without scrolling the background.
4. Verify unauthenticated login/registration/public-page links still use the same documents; no payment or user status changes after reading/closing.
5. Full-screen club TV intentionally retains its dedicated display layout and is not given an app footer.

Automated regression coverage: `src/components/LegalCenter.test.tsx` plus the existing server/frontend suites. Interactive visual/keyboard checks remain to be performed on staging; no browser-based verification is claimed.
