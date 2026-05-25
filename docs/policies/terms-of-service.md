# Terms of Service

**Source (live):** [`app/terms/page.tsx`](../../app/terms/page.tsx) — served at `/terms`
**Linked from:** Register page (consent checkbox alongside Privacy), footers
**Last shown date in copy:** "Last updated: May 2026" (placeholder)

---

## Current text (verbatim from source)

### 1. About this service

The Sales Progressor is a property transaction management platform operated by The Sales Progressor Ltd. It is provided to estate agencies and property professionals to help track, manage, and communicate progress on residential property sales and purchases. The platform is not a conveyancing or legal service.

### 2. Access and accounts

Access is granted either by direct registration or by invitation from an existing agency account holder. You are responsible for maintaining the security of your login credentials and must not share them or permit others to use your account.

Portal access links sent to buyers and sellers are unique to each individual and tied to a specific transaction. Recipients should not share or forward these links, as they provide access to personal transaction data.

Agency administrators may deactivate accounts. Inactive accounts are subject to the data retention policy described in our [Privacy Policy](./privacy-policy.md).

### 3. Acceptable use

The platform may only be used for its intended purpose of residential property transaction management. You agree not to:

- Send unsolicited, misleading, or abusive communications via the platform
- Attempt to access transaction data belonging to other agencies or individuals
- Transmit harmful content, malware, or material that infringes third-party rights
- Use automated means to extract data from the platform without authorisation
- Interfere with the platform's normal operation or its underlying infrastructure

### 4. Data and communications logging

All communications sent through the platform — including chase emails, progress updates, and portal messages — are logged and retained for record-keeping and compliance purposes. Log retention follows the schedule described in our [Privacy Policy](./privacy-policy.md).

Messages sent to buyers, sellers, or solicitors via the platform are the responsibility of the sending user and their agency. The Sales Progressor Ltd is not responsible for the content of messages composed and sent by platform users.

### 5. AI-assisted features

The platform includes AI-assisted message drafting for chase communications. AI-generated drafts are presented for review before sending — they are not transmitted automatically. You are responsible for reviewing, editing if necessary, and approving any AI-generated content before it is sent to a recipient.

The Sales Progressor Ltd accepts no liability for the accuracy or appropriateness of AI-generated drafts that are sent without adequate review.

AI-assisted drafting is performed using Anthropic's Claude API. No personal data about buyers, sellers, or transactions is included in prompts beyond anonymised role descriptions and milestone names.

### 6. Availability and limitation of liability

We aim to maintain reliable service availability but do not guarantee uninterrupted access. The platform is a communication and tracking tool. It does not provide legal, financial, conveyancing, or valuation advice. All decisions made by users based on information in the platform remain their own responsibility and that of their clients.

To the maximum extent permitted by applicable law, The Sales Progressor Ltd shall not be liable for any indirect, incidental, or consequential loss arising from use or unavailability of the platform, including loss of data, lost transactions, or missed deadlines.

### 7. Changes to these terms

We may update these terms from time to time. We will notify registered account holders of material changes by email before they take effect. Continued use of the platform after notification constitutes acceptance of the updated terms.

### 8. Governing law

These terms are governed by the laws of England and Wales. Any disputes arising from use of the platform shall be subject to the exclusive jurisdiction of the courts of England and Wales.

### 9. Contact

Questions about these terms: support@thesalesprogressor.co.uk

---

## Pre-existing review flags (8 sections, verbatim from source comments)

1. **Section 1 — About this service**: *"LEGAL REVIEW REQUIRED — confirm company name, registered address, and legal entity description"*
2. **Section 2 — Access and accounts**: *"LEGAL REVIEW REQUIRED — confirm account terms are sufficient for the credential/invite model in use"*
3. **Section 3 — Acceptable use**: *"LEGAL REVIEW REQUIRED — confirm acceptable use prohibitions are adequate and enforceable"*
4. **Section 4 — Data and communications logging**: *"LEGAL REVIEW REQUIRED — confirm the logging disclosure is sufficient as a consent mechanism under UK GDPR"*
5. **Section 5 — AI-assisted features**: *"LEGAL REVIEW REQUIRED — confirm AI liability disclaimer is adequate for the use case (draft review before send)"*
6. **Section 6 — Availability and limitation of liability**: *"LEGAL REVIEW REQUIRED — confirm limitation of liability clause is appropriately drafted and enforceable under English law"*
7. **Section 7 — Changes to these terms**: *"LEGAL REVIEW REQUIRED — confirm notification mechanism and acceptance clause are adequate"*
8. **Section 8 — Governing law**: *"LEGAL REVIEW REQUIRED — confirm governing law and jurisdiction clauses are appropriate"*

---

## Observations for the improvement pass

- **No registered company details** — Section 1 says "The Sales Progressor Ltd" but never gives the company number, registered office address, or VAT status (we're not VAT registered — see billing-terms doc). UK Companies Act 2006 trading-disclosures requirements mean we should publish these on the website. Standard footer or terms preamble.
- **No fees / pricing reference.** Terms of Service doesn't mention pricing at all. Pricing is captured separately as a versioned acknowledgement on first card-save (see [`billing-terms.md`](./billing-terms.md)) — but the relationship between "general terms" and "billing terms" should be explicitly cross-referenced. E.g. "Pricing for paid services is set out in the Billing Terms presented when a payment method is added, and accepted separately."
- **No termination / suspension clause.** What happens if a user breaches acceptable use? Can we suspend? Terminate? Refund prepaid (N/A here)? With a payment relationship now in play, the lack of termination terms is material.
- **No intellectual property clause.** Standard for SaaS — we own the platform; users own their data; reciprocal license grants. Current text doesn't address this at all.
- **No data ownership statement.** Adjacent to the above — agencies need to be sure they own/can export their data. Especially important for trust at sign-up.
- **No export / data portability commitment.** "Download my data" button exists in the Account/Profile area (exports user's data as JSON). Worth mentioning in the terms — both as a feature commitment and to reinforce data-portability rights.
- **Section 3 acceptable use overlaps with Privacy Policy and could potentially be a separate Acceptable Use Policy.** Some SaaS keep it inline (current pattern), some split it. Inline is fine for our scale — flag it as a deliberate decision rather than an oversight.
- **Section 5 AI features — gets the right disclaimer.** "Anonymised role descriptions and milestone names" — verify this matches what actually gets sent to Anthropic's API. If we ever send richer context (property address, contact names) the disclosure becomes misleading.
- **Section 5 doesn't mention training.** Anthropic's API by default does NOT train on inputs (per their commercial terms). Worth a single sentence: "Inputs sent to Anthropic are not used to train their models."
- **Section 6 limitation of liability is generic.** No monetary cap stated. Standard practice is "limited to fees paid in the prior 12 months" or a fixed sum (e.g. £X or 12-month fees, whichever is greater). For an enterprise contract this matters more; for self-serve sign-up via the register page, current loose framing may be defensible — but should be checked by counsel.
- **Section 6 doesn't carve out non-excludable liability** (death, personal injury, fraud, fraudulent misrepresentation — these can't be excluded under English law). Standard clause needed.
- **Section 7 — "by email before they take effect"** sets up an obligation we need to fulfil. Should we build a mechanism for this? Currently no Terms-version-changed email exists in the platform. Either build one, or soften the language to "we will publish the updated terms on the platform with the effective date".
- **Section 8 — exclusive jurisdiction clause** is correct posture for a UK B2B platform with UK-only customers. If we ever serve EU/international, this needs revisiting.
- **No consumer-rights carve-out.** Estate-agency directors might in some contexts be deemed acting as consumers (e.g. a single-director owner-managed agency). Consumer Rights Act 2015 limits enforceability of some standard B2B clauses against individuals acting as consumers. Worth flagging for counsel.
- **No reference to the billing terms / pricing acknowledgement.** When a director adds a card, they tick a separate, versioned acknowledgement (see [`billing-terms.md`](./billing-terms.md)). Terms of Service should reference that this exists and that paying customers also accept those terms.
- **No data sub-processor change-notification process.** Standard DPA element — when we add/change sub-processors, do customers get notified? Currently the privacy policy says "we review this list as our providers change" but doesn't commit to notifying. Improvement opportunity.
- **Cancellation / account closure not described.** A user can delete their account via the danger zone (AccountDangerZonePlain) — but the terms don't describe what happens to their data afterwards (cross-ref to privacy retention) or whether outstanding fees are still owed.
- **"May 2026" placeholder date** — same issue as Privacy Policy.
