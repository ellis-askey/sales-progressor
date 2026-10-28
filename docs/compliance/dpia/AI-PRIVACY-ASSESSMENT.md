# AI Privacy Assessment — The Sales Progressor

**Companion to:** `DPIA.md` · **Date:** 27 October 2026 · **Owner:** Ellis Askey

This is a focused assessment of every AI-powered feature, written for a non-technical reader, with the technical evidence noted so each point can be checked. It directly answers the questions a GDPR-focused client is likely to raise.

---

## 1. The AI features that exist

| Feature | What it does | Who triggers it | Provider / model |
|---|---|---|---|
| Portal "explain email" | A buyer/seller pastes a solicitor email and gets a plain-English explanation | The client, in their portal | Anthropic, `claude-haiku-4-5` |
| Chase drafting | Suggests a chase message to a party | Staff / internal team | Anthropic, Haiku |
| Inbound-email reading | Summarises a matched inbound email and suggests a milestone update for a human to approve | Automatic (connected mailbox) | Anthropic, Haiku |
| Memo-of-sale parsing | Reads an uploaded memo to pre-fill a sale | Staff | Anthropic, Sonnet (vision) |
| AI Outreach reviewer | Reviews cold-outreach copy to prospective agencies (internal marketing only; not client transaction data) | Internal | OpenAI, `gpt-5.5` |
| Weekly insight review | Summarises platform activity for internal use | Internal | Anthropic, Opus |

**Key distinction:** only the first four touch client transaction data. The OpenAI tool is an internal marketing aid and does not process client sale data.

---

## 2. The questions answered (evidence-based)

**Which provider and is it private or public?**
Anthropic's **commercial API**, accessed server-side with an API key (`lib/anthropic.ts`). This is the business API, **not** the public consumer chatbot. The client's browser never holds the key; requests go from our server.

**What data is submitted?**
- Explain email: the full pasted text, up to 8,000 characters (`app/api/portal/explain-email/route.ts`).
- Chase drafting: contact name, role and last message text, with personal data **minimised** before sending.
- Inbound-email reading: subject and body of matched emails.
- Memo parsing: the uploaded memo document.

**Is personal information automatically redacted?**
For chase drafting, yes. The explain-email tool sends the full text (compensating controls below).

**Can users submit confidential third-party information?**
It is technically possible. By decision, there is no on-screen warning; the compensating controls are that content is not stored and not used for training, and the feature can be switched off.

**Is the information stored by TSP?**
Explain email: **no.** The pasted text and the AI's reply are not stored; only a record that the feature was used is kept (confirmed in code and in the on-screen text). Other flows store the AI's *suggestion* for human review, not the raw content.

**Are prompts or responses logged?**
No raw content is written to our application logs; only identifiers.

**Does the provider retain submitted data, and for how long?**
We do not store the content or the response. The provider processes it transiently to generate the answer and does not use it for training.

**Is any of it used to train AI models?**
No. Under the commercial API terms of both Anthropic and OpenAI, submitted content is not used to train models.

**Do international transfers occur?**
Yes, to the US (Anthropic / OpenAI), covered by the providers' SCCs / UK IDTA. The content is processed transiently and is not stored by us.

**Who can access the information?**
Only the provider's systems transiently, to generate the response. Within TSP, the output is visible to the client (explain email) or the relevant staff (chase, inbound).

**Can the feature be switched off at account/organisation level?**
Yes. The "explain email" tool has an account-level feature toggle in the main settings, and it is also available inside the agent app so staff can try it before deciding for their clients.

**Are there safeguards against over-sharing?**
Chase drafting minimises data. The explain-email tool relies on content not being stored or trained on, the commercial API, and the account-level off-switch.

**Could AI responses expose one organisation's data to another?**
No. AI calls are scoped to a single file and a single user's request; there is no shared AI memory across tenants, and tenant isolation is separately verified.

**Does the AI make decisions, or just assist?**
It **assists only.** No automated decision-making with legal or similarly significant effect. Inbound-email suggestions are always reviewed and approved by a human before anything changes (`lib/services/email-interpret.ts` + the proposals review flow). Article 22 is not engaged.

---

## 3. Residual AI position

| Point | Position |
|---|---|
| Content stored by us | No (explain email) |
| Used for training | No |
| Minimised | Chase yes; explain-email relies on no-storage/no-training + off-switch |
| Off-switch | Available at account level |
| Special-category guard | None (contractually barred; accepted residual) |
| Automated decisions | None |
| Cross-tenant leakage | None (verified) |

**Overall:** the AI processing is assistive, not decision-making; it does not store or train on client content; it is optional at account level; and it cannot leak across tenants. Residual risk is **Medium**, acceptable for an assistive feature that retains no data.
