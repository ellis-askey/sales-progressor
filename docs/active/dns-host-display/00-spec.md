# DNS host display — make domain verification foolproof

Owner: Ellis · Drafted 2026-09-13 · Status: Phases 1–3 built (verified on prod data + live DNS)

Follow-up worth doing: several agency domains are on AWS Route53 and Wix, which
aren't in REGISTRAR_GUIDES yet — add those two guides (detection falls back to the
manual picker for them today, which works but isn't tailored).

Domain authentication is the make-or-break onboarding step: if an agency can't get
their DNS records in correctly, they can't send from their own domain and get ~10%
of the product's value. Today the very first field we show them is wrong for most
registrars.

## The problem

SendGrid returns each CNAME record's `host` as the **full hostname** (FQDN), e.g.
`em1234.dannybaileyproperty.co.uk`, `s1._domainkey.dannybaileyproperty.co.uk`. We
store and display it verbatim:
- `lib/services/sendgrid.ts` `parseDnsRecords` uses `r.host` as-is.
- Agent screen `components/verified-emails/DomainAuthFlow.tsx` shows `{r.host}` in
  the "Host / Name" box with a copy button.
- Command Centre `components/command/email-senders/AgencyDomainAuth.tsx` does the same.
- The registrar step-guides (`lib/verified-emails/registrar-hints.ts`) substitute
  `{host}` with the FULL host and say "Host: {host}".
- The "email these instructions to IT" text also uses the full host.

**Why that breaks:** most registrars (GoDaddy, Namecheap, IONOS, 123-reg — the
append-style majority) auto-append the domain to the Host field, so they expect the
**subdomain only** (`em1234`). Pasting the full host produces
`em1234.dannybaileyproperty.co.uk.dannybaileyproperty.co.uk` — broken. The agent has
to manually delete the domain suffix (Ellis hit this himself on GoDaddy).

## The key insight (guidance)

It is **not** a 50/50 split.

- The **subdomain-only** form (`em1234`, `s1._domainkey`) works on **every** common
  registrar: GoDaddy / Namecheap / IONOS / 123-reg *require* it, and Cloudflare /
  Google *accept* it (they normalise either form).
- The **full FQDN** form only works on Cloudflare / Google and **breaks** the
  append-style majority.

So the subdomain form is the **universally-safe default**. The only setups that ever
want the full name (with a trailing dot) are advanced ones (AWS Route53, raw BIND) —
not this market. There is no meaningful group of agency users who need the full FQDN;
we keep it only as a labelled fallback for the rare edge case.

This answers "how do we tackle both without knowing the registrar": default to the
subdomain (right for ~all), show the full host as an explicit fallback, and — later —
let them pick their provider for exact steps.

## Phases

### Phase 1 — Subdomain-first, both surfaces (the defining fix)
- New shared `relativeHost(host, domain)` (+ tests): strips `.{domain}` off the host,
  returns `@` for the apex, falls back to the full host if it doesn't end in the
  domain (never worse than today).
- `DomainAuthFlow` + `AgencyDomainAuth`: the "Host / Name" value + its copy button
  use the **subdomain** form. Add a small, clearly-labelled **"Full name (only if
  your provider asks for it)"** line showing the full host with its own copy.
- One plain-English explainer: "Enter just the part before your domain — your
  provider adds `{domain}` automatically."
- Registrar step-guides substitute `{host}` with the **subdomain** form (correct for
  all of them, since the subdomain works everywhere).
- The "email these instructions to IT" text uses the subdomain form, with the full
  host noted.
- Shared helper so the two surfaces + the guides + the email can't drift.

### Phase 2 — Provider-tailored view
"Which provider hosts your domain?" picker (we already keep the registrar list).
Selecting one shows the exact value + that provider's steps and hides the other form —
the clearest possible. Also carries any per-provider value quirks (e.g. a trailing dot
on the target for the rare few that need it).

### Phase 3 — (optional) Auto-detect the provider
Look up the domain's nameservers server-side to identify the DNS host (Cloudflare /
GoDaddy / …) and pre-select the picker: "Looks like you're on GoDaddy — here's exactly
what to do." Nice-to-have; defer.

## Notes / non-goals
- The **Value / Points to** side (`u1234.wl.sendgrid.net`) is entered as-is on every
  registrar — no change needed there.
- DNS **verification** (the "check now" call) looks up the full FQDN regardless of what
  the user typed, so it's unaffected by the display change.
- No schema change, no migration.

## Order
Phase 1 now (removes the breakage for almost everyone, low risk) → Phase 2 next →
auto-detect later.
