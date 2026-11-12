# Medical certificate review

- A complete signed health questionnaire is distinct from medical eligibility. A YES answer allows account registration and checkout, with a pending-medical warning. It does not authorize booking or check-in.
- Manager: **Declarations and entry → health declaration archive**, or **Trainees → edit details → health**. Upload a doctor PDF/PNG/JPEG/WebP (up to 5 MiB), inspect the file, tick the review checkbox, then explicitly approve it. Upload alone is not approval.
- Only authenticated MANAGER accounts may call `POST /api/admin/medical-certificate`. Generic profile synchronization cannot approve certificates or rewrite original signed records. Approval is tied to the current document ID; concurrent replacement requires refresh/review.
- Uploads and reviews are appended to the existing declaration with actor and timestamp. Original answers, signature, signed date and annual expiry are preserved. Replacement resets approval. An expired declaration requires a fresh trainee signature; doctor approval does not renew it.
- Existing legacy pending declarations with a recorded signature may be approved without rewriting their historical signed flag; the current eligibility flag is updated separately.
- No payment is created, confirmed or waived by medical review. Unpaid members remain blocked after approval. Pages demo has no real medical review endpoint.
- Existing inline document storage is retained for rollback compatibility. Do not put medical documents or their data URLs into logs, issues, screenshots or test fixtures. Automated tests use synthetic document headers only. This change does not certify medical fitness or legal compliance.
