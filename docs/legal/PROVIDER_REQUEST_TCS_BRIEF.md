# Briefing — Terms & Conditions for the Provider Request Service
Purpose: give this to Claude (or a solicitor) to generate consumer-facing Terms & Conditions for The Sales Progressor's "provider request" / quote-request service. Everything below is drawn from the actual product implementation. **Not legal advice — the regulatory points (especially mortgage introductions) need a solicitor's review before going live.**

---

## 1. What the service is (factual)
The Sales Progressor ("TSP", "we") operates a UK estate-agency sales-progression platform. As part of a live property sale, a **buyer or seller ("you", "the client")** can use an in-platform tool to **request quotes / introductions to third-party service providers**. The client receives a secure tokenised link (from their portal / email), selects a service and one or more listed firms, and submits contact preferences. TSP forwards the request to the selected provider(s); **the provider then quotes and contracts directly with the client.**

**Provider types (exactly three):** surveyors, mortgage brokers, structural engineers.
**Services:** e.g. survey types for surveyors (a configurable list), broker introductions, structural inspections.

## 2. The parties and roles (the spine of the T&Cs)
- **TSP = an introducer / facilitator only.** TSP does not provide surveys, mortgage advice, or structural-engineering services, and is **not a party** to any contract between the client and a provider.
- **Provider = an independent third-party firm.** Any service, quote, price, appointment and contract is **directly between the client and the provider**, governed by the provider's own terms.
- **Client = a consumer** (a buyer or seller in a residential transaction).

## 3. The actual flow (so the terms match reality)
1. Client opens a tokenised request page for their specific property.
2. Client chooses a service type + one or more firms + contact method (phone/email/text/WhatsApp), preferred window, and urgency; optional notes.
3. On submit, TSP **snapshots and shares** with each selected provider: client name, email, phone; property address, postcode, price and tenure (where known).
4. Provider contacts the client and quotes / arranges the service directly.
5. TSP tracks status: pending → booked → won / not-chosen / lost / expired.

## 4. Commercial terms (referral fees)
- TSP receives a **referral fee from the provider** when business is placed — **default 10% of the fee the provider charges the client** (configurable per case). Paid by the provider, tracked internally; PENDING CONFIRMATION whether this ever affects the price the client pays.
- The T&Cs **must disclose** that TSP receives a referral fee (transparency requirement — see §7).

## 5. Data protection (UK GDPR)
- Submitting a request means the client's personal data (name, contact details, property details) is **shared with the selected provider(s)**, who act as **independent data controllers** for their own use.
- Lawful basis: performance of the requested introduction / the client's consent. Cross-reference TSP's main Privacy Policy.
- **Retention:** the client's personal data on a request is anonymised **12 months after the request reaches a terminal status** (won/lost/expired); aggregate/non-personal data (postcode, service kind, fees) is retained for analytics.

## 6. Credentials shown
- Firm listings may show trust signals (e.g. **RICS-regulated**, **Chartered Engineer**, established year, typical turnaround). These are **as supplied by the firm**, are informational, and are **not a recommendation, endorsement, or warranty** by TSP. Clients should verify a provider's credentials/regulatory status themselves.

## 7. Clauses the T&Cs MUST contain
1. **Introducer status / no contractual relationship** — TSP facilitates introductions only; the service contract is solely between client and provider; TSP is not the provider and not a party to it.
2. **No advice, recommendation or endorsement** — listing/availability of a firm is not a recommendation; TSP gives no advice on which provider to choose or whether to use one at all.
3. **No warranty** — TSP does not guarantee that a quote will be given, its price, turnaround, availability, or the quality/timeliness/accuracy of any provider's service or quote.
4. **Limitation & exclusion of liability** — TSP not liable for the provider's acts/omissions, quotes, service, delays or losses arising from them; exclude indirect/consequential loss; cap liability; preserve non-excludable statutory liabilities (death/personal injury from negligence, fraud, and anything that cannot be excluded under UK consumer law).
5. **Referral-fee disclosure** — clear statement that TSP receives a referral fee from providers, the basis of it, and (confirm) that it does not increase the price the client pays.
6. **Data sharing & privacy** — what is shared, with whom, why, that providers are independent controllers, the 12-month anonymisation, and a link to the Privacy Policy.
7. **Client responsibilities** — provide accurate information; make your own decision to engage a provider; deal with the provider directly for the service.
8. **Complaints** — complaints about a provider's service go to that provider (and their regulator, e.g. RICS/FOS where relevant); complaints about the introduction service to TSP; give a contact route.
9. **No obligation / free to shop around** — using the service is optional; the client is free to obtain quotes or services elsewhere.
10. **Cancellation / changes** — the client may cancel a request before engaging a provider; provider engagements are governed by the provider's own cancellation/cooling-off terms.
11. **Changes to terms, entire agreement, severability, governing law = England & Wales, jurisdiction.**

## 8. REGULATORY FLAGS — do not skip (solicitor review needed)
- **Mortgage-broker introductions are FCA-regulated territory.** Introducing consumers to a mortgage broker for regulated mortgage advice, *and taking a fee for it*, can itself be a **regulated activity**. TSP must either (a) be an **FCA Appointed Representative**, or (b) structure the introduction to fall within the **introducer exclusion (Article 33 RAO)** — i.e. do no more than pass contact details, give no advice, and **disclose the fee to the client and the broker**. The T&Cs (and the product copy) must be consistent with whichever route applies. **This is the single biggest legal risk — confirm FCA position first.**
- **Referral-fee disclosure** — CMA guidance and RICS professional rules require referral fees to conveyancers/surveyors to be disclosed to the consumer. The disclosure must be clear and prominent, not buried.
- **Consumer law** — clients are consumers: the Consumer Rights Act 2015 and unfair-terms rules apply, so liability exclusions must be reasonable and cannot exclude non-excludable liabilities.
- **Conveyancer/solicitor referrals** exist elsewhere in the product (a separate referral mechanism on the transaction, not this quote flow) — decide whether these T&Cs should also cover them or stay scoped to surveyor / mortgage-broker / structural-engineer only.

## 9. Details TSP must supply before finalising
- Legal company name, company number, registered office, contact email for legal/complaints.
- **FCA status for mortgage introductions** (Appointed Representative? relying on the introducer exclusion?) — critical.
- Exact referral-fee basis and whether it's always paid by the provider and never increases the client's price.
- Any vetting TSP actually performs on providers (affects how strongly the "no endorsement" wording is drafted).
- Whether to include a distinct short **fee-disclosure line** shown in the request UI itself (recommended, in addition to the T&Cs).

---

## 10. Ready-to-use prompt for Claude
> "You are a UK commercial solicitor. Draft consumer-facing Terms & Conditions for 'The Sales Progressor's Provider Request Service', governed by the laws of England & Wales, for consumers (property buyers and sellers). Use the briefing below as the sole source of facts. The company operates ONLY as an introducer/facilitator between the consumer and independent third-party providers (surveyors, mortgage brokers, structural engineers); it is not the provider and not a party to the service contract. The terms must include every clause listed in section 7, disclose the referral fee (section 4), reflect the data-sharing and 12-month anonymisation (section 5), and be consistent with the regulatory flags in section 8 — in particular treat mortgage-broker introductions carefully (FCA introducer exclusion / referral-fee disclosure). Where a fact is missing (e.g. FCA status, company details), insert a clearly-marked [PLACEHOLDER] and add a note. Output plain, readable T&Cs in numbered sections with headings, plus a short cover note flagging the points that require a solicitor's sign-off before publication. [PASTE SECTIONS 1-9 HERE]"

*Reminder: this brief is engineering-derived, not legal advice. The mortgage-introduction/FCA and referral-fee-disclosure points in particular should be confirmed with a solicitor before these T&Cs go live.*
