# Personal Data Breach Response Runbook — The Sales Progressor

**Owner:** Ellis Askey (data-protection lead and breach owner)
**Date:** 27 October 2026 · **Review:** annually, or after any incident
**Backs:** the 72-hour notification commitment in our Data Processing Agreement.

This is the step-by-step to follow if personal data may have been exposed, lost, altered, or accessed by someone who shouldn't have it. A "personal data breach" is any security incident affecting personal data, not only a hack: a lost laptop, an email sent to the wrong person, a misconfigured storage bucket, or a database left open all count.

Move quickly but do not panic. The clock that matters (72 hours) starts when you become **aware** a breach has likely happened, not when you have every detail.

---

## At a glance

1. **Detect & record** — write down what you know, with timestamps.
2. **Contain** — stop it getting worse (revoke, rotate, take offline).
3. **Assess** — what data, whose, how much, what's the risk to people.
4. **Notify** — affected agencies (as their processor) without undue delay and within 72 hours; the ICO and individuals where required.
5. **Recover & learn** — fix the root cause, write it up, update controls.

---

## Step 1 — Detect and record (immediately)

Open a dated incident note (e.g. `docs/active/incident-YYYY-MM-DD-short-name.md`). Capture:
- When and how you found out, and who reported it.
- What you currently believe happened, in plain terms.
- Which systems are involved (database, file storage, a mailbox, WhatsApp, a sub-processor).
- Keep a running timeline with timestamps. Every later decision gets added here.

Do not delete or alter anything that might be evidence (logs, emails, messages).

## Step 2 — Contain (within the first hour where possible)

Stop the bleeding before investigating fully:
- **Account compromise:** force a sign-out of all devices (bump the user's session), reset the password, and enable or reset two-factor. Deactivate the account if needed.
- **Leaked portal or share link:** reset the client's portal link (the reset button on the contact), which kills the old link instantly.
- **Exposed secret / API key:** rotate it (Vercel env + the provider), redeploy.
- **Misconfigured storage:** make the bucket private again; expire or rotate any public URLs.
- **Wrong-recipient email:** ask the recipient to delete it and confirm; record their response.
- **Sub-processor incident:** contact the provider, get their incident reference, and follow their guidance.

## Step 3 — Assess the risk to people

Answer, as best you can:
- **What data?** Names, contact details, financial/mortgage details, documents (possibly ID), correspondence.
- **Whose, and how many?** Which agencies, buyers, sellers, solicitors; rough numbers.
- **What could happen to them?** Distress, fraud, identity theft, financial loss. Higher-sensitivity data (ID, financial) means higher risk.
- **Is the data readable?** Encrypted/anonymised data that stays protected may lower the risk.

This assessment decides who you must notify (Step 4). Record your reasoning, even if the conclusion is "low risk, no notification required" — you must be able to justify it.

## Step 4 — Notify

**Your role matters.** For an agency's client data you are the **processor**; the agency is the **controller**. Your job is to tell the agency promptly so *they* can meet their obligations. For your own account/staff data you are the controller and notify the ICO/individuals yourself where required.

- **Affected agencies (as processor):** notify **without undue delay** and, in any event, **within 72 hours** of becoming aware. Give them: what happened, when, what data and roughly how many people, the likely consequences, what you've done to contain it, and your contact point. This is the DPA commitment.
- **The ICO (where you are controller and there is a risk to people):** report within **72 hours** of becoming aware. If you miss 72 hours, still report and explain the delay. ICO breach line / online form: ico.org.uk. (Below the risk threshold, record why you didn't report.)
- **Affected individuals (where there is a *high* risk to them):** tell them directly, in plain language, what happened and what they can do (e.g. watch for suspicious contact, change a password). For client data this is usually done by the agency; coordinate.

Keep copies of every notification and when it was sent.

## Step 5 — Recover and learn

- Fix the root cause, not just the symptom.
- Restore any lost data from backups; verify integrity.
- Finish the incident note: timeline, cause, impact, actions, notifications, lessons.
- Update controls so it can't recur (a setting, a check, a code change, a process).
- Add any follow-up actions to `docs/active/ELLIS_MANUAL_TODO.md`.
- Log the incident in the breach register below.

---

## Breach register

| Date | Short description | Data / people affected | Severity | Notified (who / when) | Status |
|---|---|---|---|---|---|
| _(none logged)_ | | | | | |

---

## Quick contacts & levers

- **ICO:** ico.org.uk (online breach report + helpline).
- **Hosting / database (Supabase, Vercel):** provider dashboards for logs, access, and rotating secrets.
- **Email (SendGrid):** suppression, sending controls, inbound parse.
- **Key levers in the product:** force sign-out (session bump), reset a portal link, rotate an env secret + redeploy, make a storage bucket private, deactivate a user, anonymise a contact (Command Centre).

If in doubt about whether something is reportable or how, treat it as reportable and take qualified UK data-protection advice. Over-reporting is safer than missing a required notification.
