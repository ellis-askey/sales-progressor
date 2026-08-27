# Three notes (batch 2) — distilled to plans

Captured 2026-08-27 from Ellis's raw notes. Each is a **separate concern / separate PR** (Law 5). Format per note: what you said → what's actually there today (verified) → proposed design → the decisions I still need.

## ✅ STATUS — all three shipped to staging + production 2026-08-27
- **Note A — cross-chain onward-neighbour emails: SHIPPED.** New per-agency opt-in (off by default), curated high-signal confirms only, stub-agent unsubscribe/suppression, sent from the agency identity via the chain-invite sender. Prod deploy green.
- **Note B — helper/representative contact: SHIPPED.** `Contact.isPrincipal` + `Contact.portalEligible` (migration `20260827160000_contact_helper_flags`, applied staging + prod). Helpers excluded from every "who confirmed" name list; "{helper} confirmed on behalf of {client}" on agent/own-side surfaces, client-only on the other side; add + edit UI with helper toggle + portal tickbox; Helper badge on the file card. Prod deploy green.
- **Note C — skipped steps show "Up next" forever: SHIPPED.** `resolveDisplayStages` now settles a stage on complete OR not_required, reports a new `skipped` status rendered muted/struck on the strip; weekly brief self-heals. 4 tests added. Prod deploy green.

Build order used: **Note C** (small, clear bug) → **Note B** (contact type, migration) → **Note A** (cross-chain email, biggest + legal angle).

---

## Note A — Email the agent above/below when a client confirms

### What you said
> Buyers and sellers enter their related party (if not already entered in the chain by us or the agent — I believe it's all set up correctly). Then when they confirm something, it sends an email to the agent above/below confirming it — providing value before they use us.

### What's actually there (verified)
- **The plumbing you believe is set up, is.** The chain model (`PropertyChain` / `ChainLink`), the neighbour walk (`getPortalChainAgent`, position ±1), and the flow where a client enters their onward/selling agent (`updateMyChainAgentAction` → `writeClientChainStub`, surfaced in `PortalTeamCard` / `PortalEditDrawer`) all exist and work. A client-supplied neighbour lands in `stubAgentEmail` (but is **not** auto-invited — the managing agent decides).
- **When a client confirms a milestone via the portal, nothing fires to the chain.** All existing notifications on a client confirm go *inward* (to the file's own agent). And exchange/completion/enquiries-satisfied codes are **hard-blocked** from client confirmation.
- **The one existing cross-chain milestone email** (`enqueueChainMilestoneNotifications`) only fires on exchange/completion, only from the *agent* path, and only to **already-joined (claimed)** chain-mates. It never emails an unclaimed, not-yet-customer agent.
- **So the valuable part of your idea — emailing a neighbour agent who isn't a customer yet — has no implementation at all.** That's the net-new build.

### Two real snags to design around
1. **The neighbour's email isn't guaranteed.** A client may have supplied only the neighbour's name/agency, not an email. No email → no send.
2. **Cold-emailing a non-customer agent is legally sensitive.** A stub agent has no user account, so none of the existing unsubscribe/suppression applies. A "value before they're customers" email to them needs its own consent/unsubscribe handling (and, realistically, an agency opt-in), or it's spam.

### Proposed design
- A new fire-and-forget hook in the **client** confirm path (`portalCompleteMilestone`, post-commit) that, on a **chained** file, resolves the neighbour above/below and — if we have an email — enqueues a **branded** "good news from the chain below/above you" email: *"The buyers of 14 Beaumont Rise have just confirmed their searches are back."* Sent from the **agency's** identity (reuse `resolveChainInviteSender`, not bare "Sales Progressor"), with a soft "see the whole chain / get set up" CTA.
- Reuse `getPortalChainAgent` (resolution), `enqueueEmail` + `OutboundEmailQueue` (dedup + quiet hours).
- **Gated behind a new per-agency opt-in**, off by default. Plus per-recipient unsubscribe (new, because stubs aren't users).

### Decisions I need
- **A1. Which confirmations trigger it?** Every client confirm (could be a lot of email to a neighbour), or only a few high-signal ones (mortgage offer in, searches back, enquiries satisfied, ready to exchange)? **My lean: a curated shortlist**, not every step.
- **A2. Who receives — claimed neighbours (already customers), unclaimed stub neighbours (pre-customers), or both?** The "value before they use us" angle = **stub** neighbours, which is the legally-sensitive path. Confirm you want to email non-customers (with unsubscribe), or keep it to already-joined agents only for now.
- **A3. Gating + default.** New per-agency toggle, default **off** (opt-in)? My strong lean: yes — outbound to non-customers should never be on by default.
- **A4. Consent/unsubscribe for stub agents** — required if we email non-customers. Confirm I should build a per-stub unsubscribe + suppression list.
- **A5. Direction.** Based on the confirming side (a buyer's confirm → the agent below; a seller's → the agent above), or always both neighbours? My lean: the relevant single neighbour.

---

## Note B — A "helper / representative" contact on a side (not the buyer/seller)

### What you said
> Maybe we need a type of contact on a side but not the vendor — so updates stay correct. If Lucy is helping, it shouldn't say "Mrs Ayres and Lucy Beaumont have been issued their contracts", just "Mrs Ayres has been". Need to decide who gets a portal, or if not buyer/seller, is it a tickbox to confirm they should. Best UI/flow?

### What's actually there (verified)
- **No non-principal concept exists.** `ContactRole` is `vendor | purchaser | solicitor | broker | other`. A helper on the seller side would have to be typed `vendor` today — which is exactly what breaks the copy.
- **The copy bug is real and lands on the work we just did.** `sideContacts` (built in `comms.ts` and `agent.ts` by `roleType === side`) feeds `confirmationSentence`, and `joinNames`/`allClientNames` name **every** side contact. So a helper is wrongly joined into "X and Y confirmed…" and the solicitor "issued the contract to {clients}" line.
- **Every contact silently gets a portal token at creation** (5 insert sites). The UI only *shows* the portal for `vendor`/`purchaser`. So "gets a portal" today = "is a buyer/seller", with the token already minted regardless.
- Add/edit UI has only name/phone/email/(role); **role can't be edited after creation**. The new-sale form already shows "Eligible for portal invite" copy — a natural home for a per-contact toggle.

### Proposed design
- **Keep `roleType` as the side** (vendor/purchaser). Add a small **discriminator field** on `Contact` (a boolean, not a new enum value — far lower blast radius): a **principal client** vs a **helper/representative**.
- **Two independent things, because your note implies both:**
  1. **Principal vs helper** → drives whose name appears in confirmation copy. Helpers are excluded from the joined names (fix the two `sideContacts` filters + the pronoun logic).
  2. **Portal eligibility** → a separate **tickbox** ("give them a portal"), so a helper *can* still get a portal if they're the one actually doing things (e.g. a trust's representative), and a principal could in theory be portal-less.
- UI: add "role on this side (principal / helper)" + "give them a portal" to both the file contacts panel and new-sale Stage 2, and **make role editable** in the edit form.
- Migration: default existing contacts to principal + portal-eligible (no behaviour change for current data).

### Decisions I need
- **B1. Model shape.** One flag (`isPrincipal`) that also implies portal, or two independent flags (`isPrincipal` for copy + `portalEligible` for the portal tickbox)? **My lean: two** — your note explicitly wants portal to be a separate choice.
- **B2. The trust/representative copy semantics.** For a trust owning the property, does the confirmation read as the **principal's** name (e.g. "The Ayres Trust" / "Mrs Ayres") with the helper silent, exactly as your example? Confirming the helper never appears in the "X confirmed" copy, but can still receive emails / hold a portal.
- **B3. Defaults.** Principals auto-eligible for a portal (as today); helpers portal-less unless ticked. Confirm.
- **B4. Scope of the copy fix.** Just exclude helpers from the names, or also revisit how a single principal + a helper reads (pronoun "their" vs "her")? (Minor, but it's in the same code.)

---

## Note C — Skipped steps show "Up next" forever on the timeline

### What you said
> When searches are skipped, the timeline on the property file (steps page) still shows "up next" (I saw it on 4 Covert Road) — so it'll stay like that forever.

### What's actually there (verified) — clean, isolated bug
- **Root cause, one line:** `resolveDisplayStages` (`lib/milestones/display-stages.ts`) derives each stage's state **only from `isComplete`** and never looks at `not_required`. A skipped stage has `isComplete = false`, so it can never complete, and as the earliest non-complete stage it's pinned to **"Up next"** forever.
- It feeds the **timeline strip** (`MilestoneTimelineStrip`) — whose `StageStatus` has no "skipped" value — and the **agent weekly brief** (which then mislabels the file's "current stage" as the skipped one). Same root cause fixes both.
- **Everywhere else already handles it correctly** (good models for the fix): the Steps tab has a proper "Skipped" section, the Overview next-action excludes skipped, and the Activity timeline shows a "Skipped" pill. So this is contained to the strip + weekly brief.

### Proposed design (small, well-scoped)
- Widen `resolveDisplayStages`'s input to include `isNotRequired` (callers already pass it), treat a stage's exit codes as satisfied when **complete OR not_required**, and add a new `"skipped"` `StageStatus`.
- Render skipped on the strip as a muted, struck-through node labelled **"Skipped"** (mirroring the Activity timeline's treatment) — with the *real* next stage correctly becoming "Up next".
- Add a test (currently none covers a not_required stage). The weekly-brief mislabel fixes itself once the resolver stops marking skipped stages as up-next.

### Decisions I need
- **C1. The skipped visual on the strip** — muted + strikethrough + "Skipped" label + a dash instead of the step number (matching the Activity tab)? Or a different treatment you'd prefer. Otherwise this is just a fix, no product decisions.

---

## Summary of what I need from you
- **A:** A1 (which confirms), A2 (email non-customers?), A3 (opt-in default), A4 (build stub unsubscribe), A5 (direction).
- **B:** B1 (one flag or two), B2 (trust copy semantics), B3 (defaults), B4 (copy-fix scope).
- **C:** C1 (skipped visual) — otherwise good to build.

Comment on these and I'll build in the order C → B → A.
