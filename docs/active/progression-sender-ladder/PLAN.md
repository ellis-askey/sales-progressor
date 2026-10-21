# Progression sender ladder — client-facing email identity for outsourced files

Founder-approved 2026-10-21 (conversation: Key To Completion audit). Goal: a
progression company's own domain (e.g. jo@keytocompletion.co.uk) must NEVER
appear to buyers, sellers, solicitors or brokers — not in From, not in
Reply-To, not in the footer — while every client reply still reaches the
progressor's real inbox AND is filed on the sale. Agent-facing email is
unchanged (the agent is the progressor's client; their identity is expected).

## The From ladder (client-facing sends on an external-business outsourced file)

1. **Provisioned per-(company, agency) sender** (`ProgressionBusinessClient.senderEmail`,
   verified). From = Reply-To = it. Unchanged; the gold standard.
2. **Agency's own verified sender**, only at a single-progressor agency (so it
   unambiguously belongs to that company). Unchanged.
3. **Minted on the agency's authenticated domain** — two flavours:
   a. *Inbound subdomain delegated* (agency added our MX record for
      `progression.{domain}` during DNS setup; verified by the check-domains
      cron; host registered with SendGrid Inbound Parse): From = Reply-To =
      `{first}@progression.{domain}`. Everything sent to it — replies AND fresh
      composes — reaches our webhook: filed on the sale (best-effort by sender
      match) and ALWAYS forwarded to the progressor's real inbox. Zero-loss.
   b. *Domain authenticated only*: From = `{first}.updates@{domain}` (domain
      auth authorises any local part); Reply-To = the per-file reply-capture
      alias (`reply+<token>@REPLY_CAPTURE_DOMAIN`) → filed on the sale +
      forwarded to the progressor (webhook already does both). A fresh compose
      to the minted From bounces VISIBLY to the sender (not silent loss);
      upgrading to (a) closes even that.
4. **Nothing verified**: From = `updates@thesalesprogressor.co.uk`; Reply-To =
   the per-file capture alias as in 3b. The progressor's login email is used as
   Reply-To ONLY if REPLY_CAPTURE_DOMAIN is unset (environment regression
   safety) — never by design.

Minted names: the assigned progressor's first name, lowercased. If another
active progression company at the same agency has a member with the same first
name, append the surname initial (`jo.s`). Minted addresses are always
per-company — nothing is ever shared between two progression companies.

## Reply handling

- Tiers 1/2: replies go to the provisioned mailbox (as today).
- Tier 3a: replies + fresh composes arrive at our webhook via the agency
  subdomain → best-effort file by sender match → always forward to the
  progressor's real email.
- Tiers 3b/4: replies go to the per-file capture alias → filed on the exact
  sale (token = file) → forwarded to the progressor's real email (existing
  sendgrid-inbound webhook behaviour).
- The compliance footer shows the BRANDED visible address (the From), never the
  raw Reply-To — so capture aliases and login emails never print.

## Build order

- Commit A: ladder tiers 1/2/3b/4 + capture Reply-To + footer fix (closes the
  live leak for every business immediately).
- Commit B: tier 3a inbound-subdomain infrastructure (schema, MX record in the
  DNS setup flow, SendGrid parse-host registration, cron verification, webhook
  minted-address handling).

## Invariants (stress-test these)

- No client-facing send on an external-business file may carry the business's
  own domain in From, Reply-To, or footer.
- Two progression companies at one agency never share a From, a Reply-To, or a
  forward target.
- Every client reply reaches the assigned progressor's real inbox.
- TSP-run files and agent-facing email are byte-identical to before.
