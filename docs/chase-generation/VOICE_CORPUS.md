# Voice Corpus — Sales Progressor Chase Messages

**Purpose.** Real anonymised messages sent by the sales progressor, grouped by tone and channel. These are the canonical reference for *what good output looks like*. The prompt spec (`app/api/ai/generate-chase/PROMPT_SPEC.md`) describes the rules; this document shows the rules in action.

**Use.** When a future change to the prompt is being considered, read these first. When debugging a generated message that feels off, compare it to these. The model should produce output that could plausibly sit alongside any of these without standing out.

**Anonymisation.** Property addresses, full names, firm names, email addresses, phone numbers, and case-management product names have been redacted. The voice, structure, length, and content are otherwise unchanged from the original messages.

**Source.** 30 messages curated from a corpus of 246 real outbound communications (77 emails, 169 WhatsApps) sent over a one-month progression period. Selected to show range across tone bands and channels. Playful or unusually casual openers ("Hola", elongated "Goooooood morning", etc.) are excluded — they are real but rare, and the standard professional-warm voice is the one to anchor on.

---

## Section 1 — WhatsApp examples

### 1.1 Friendly / general check-in

> Morning [Name],
>
> Hope you are well!
>
> Just to keep you posted, I'm just chasing up the buyer and their solicitor to confirm they've actioned their next steps. Nothing outstanding on your side. It'll stay that way until they raise their initial enquiries. As soon as we hear that these are with your solicitor, we'll let you know and then you can touch base. If there's any update from them, please let me know 🙂

---

> Morning [Name],
>
> Hope you had a lovely weekend!
>
> Just caught up with [firm], who kindly confirmed the searches are underway and the last of the results are due back approx 27th April. Next step for them is to raise their initial enquiries. Once they've let you know this has been done, could you confirm on the portal please or pop me a message? Thank you 🙏🏼

---

> Morning [Name],
>
> Hope you guys had a lovely sunny weekend!
>
> Just a quick update to let you know, the seller's solicitor informed us just before the weekend that all currently raised enquiries have been responded to — so ball is back in your solicitor's court from a conveyancing point of view 🙂

---

> Good morning,
>
> Hope you're well and had a lovely weekend!
>
> Just a quick message to say, please let me know once you guys are in receipt of the survey report — I'll then notch off another bit of progress on the portal for everybody ✌🏼
>
> Hopefully all is well on survey, but just let me know if there's anything that needs to be discussed.

---

### 1.2 Quick factual update / heads-up

> Our buyers have made payment to their solicitor for searches, which concludes their onboarding 🙂
>
> Since draft contract pack went out today, I'll give them a day or two to confirm they've ordered those searches. If I don't have confirmation of this by Thurs, I'll look to get in touch with buyers/solicitors to make sure we get confirmation before the weekend.

---

> Good morning,
>
> Just a quick update to start the week. Your solicitor sent across an amended doc/response on Friday afternoon, so that hopefully concludes enquiries.
>
> I will hopefully hear this week officially from buyer's solicitor that all enquiries are satisfied, and that they've sent him his final report & contract to sign.
>
> Once that happens, I will let you know 🙂🤞🏻

---

### 1.3 Polite-yet-firm — milestone slipped, recoverable

> Good morning [Name],
>
> Hope you are keeping well!
>
> I just wanted to touch base to confirm you've not completed your ID checks with the solicitors, and also paid them an initial payment for searches etc? If so, I'll touch base with them today to keep things moving forwards.

---

> Morning [Name],
>
> Hope you had a lovely weekend!
>
> Did you manage to get through to solicitors to complete their ID & Anti-money-laundering checks? I'm not sure they'll issue the draft contract pack (which the buyer's solicitor needs to proceed with things) until checks are complete, so just want to make sure we don't end up holding things up 🙂

---

> Good morning [Name],
>
> Hope you are well.
>
> I just wanted to touch base before the weekend to ask whether the mortgage application has been submitted by your broker yet?

---

### 1.4 Chase up — previous message unanswered

> Good morning,
>
> Hope you guys had a lovely weekend.
>
> Would you be able to obtain confirmation from [Name] that the searches are underway please? I wasn't able to get a response last week.

---

> Morning [Name],
>
> Just chasing up your solicitor on these initial enquiries we're waiting on them to raise.
>
> In the meantime, wanted to ask if you'd chosen/instructed a surveyor for a Level 2 (Homebuyer's) Survey? That's really the only thing left on your side to personally do at the moment.

---

> Just chasing up our buyer's solicitor for an update on whether they have reviewed replies to enquiries, and if they have, whether all enquiries are now satisfied or if they'll be raising anything further.
>
> Will of course let you know once we hear back!

---

> Morning [Name],
>
> I'm just checking with the seller's solicitor to see if they issued the draft contract pack to your solicitor before the weekend or not.
>
> Did the broker give any update on whether the mortgage is formally submitted?

---

### 1.5 Firm — sustained silence, escalating concern

> Hi [Name],
>
> I hope you are well.
>
> I've not heard back from you on the last few messages regarding your progress with the onboarding. Is everything okay?
>
> If all is well, please could you let me know if you have completed your ID checks and paid funds on account to your solicitor? Once this is all in place, I will chase up the seller's solicitor to issue the draft contract pack to your solicitor for review.

---

> Morning [Name],
>
> Hope all's well your end. I was just looking at the file for [property], and noticed the buyer's solicitor hadn't raised their initial enquiries yet. They are still waiting on 2 forms to be sent to them before they can do so. [firm] are waiting on these forms from you (not sure if you are aware of this?)
>
> Outstanding forms to be completed & returned are TA6 (Property Information Form) & TA7 (Leasehold Information Form).
>
> If you don't have these, please email [firm] and CC me in. If you are still working your way through them, just let me know and I'll let everybody involved know it's in process.

---

### 1.6 First contact — introducing yourself

> Hi [Name],
>
> Hope you are keeping well!
>
> Just a very quick follow up to the voicemail I've just left for you. I'll be your sales progressor for the sale of [the property], which means I'll be here in the background keeping things moving along — and also available to help you guys where needed 🙂
>
> I'm going to send you both an email in the next 5 minutes, which will allow you to set a password for our portal. Once you've set your password, you can confirm steps there which then keeps us posted and helps us know when to chase the other side! Plus a few handy little tips in there too.
>
> I spoke with [firm] this morning, who confirmed that they are not yet fully instructed, so next step is to complete the onboarding with solicitors.
>
> Please let me know if you need anything at all.
>
> Best regards,
> [Sender] @ [firm]

---

### 1.7 Negotiation / serious briefing — vendor side

> Morning [Name],
>
> Hope you're well. Just tried to call you to catch up on the above.
>
> I wasn't able to speak with [other party] yesterday as it was his birthday, so we've caught up this morning.
>
> My personal opinion here is unfortunately, I feel we will need to agree to the £5K reduction (£2.5K each). It seems the buyer is not going to budge on the £5K request, and has already brought it down from £7K. With the market being the way it is, the rates going up, less buyers around with the uncertainty, I would say it's worth doing. If we lose [buyer] as a buyer, there's no guarantee we get the same price again.
>
> Offers tend to come in £5K increments, so if we went back to market and the best offer we could get is £420,000, that's essentially what [buyer] is offering now — but if that comes from a new buyer, we have to start the 3 month process again so it's time and money — plus, solicitors fees etc.
>
> Would you be happy to agree to a £2.5K split with [other party] to get this deal across the line?

> **Why this works:** Vendor is the progressor's client; full strategic context is appropriate. Note this level of detail would NOT be sent to the buyer side. See data boundaries section of the spec.

---

### 1.8 Negotiation / serious briefing — purchaser side (same negotiation, different recipient)

> I've now spoken with both [vendor 1] & [vendor 2] regarding the proposed reduction.
>
> They are open to negotiating, however they do feel that £5,000 is a little high for the works being suggested. Their view is based on a recent quote obtained next door for similar works across the entire property, which came in at £2,760.
>
> With that in mind, they are prepared to meet you part way with a reduction of £2,000, bringing the agreed price to £383,000.
>
> Given the comparable quote and the willingness shown on their side to move, this feels like a fair and reasonable position for both parties. Please let me know if you're happy to proceed at this figure so we can keep things moving forward.

> **Why this works:** Purchaser receives the *outcome* of vendor-side discussion (their counter-offer + the reasoning that supports the counter), but no internal sentiment, no "personal opinion," no commentary on whether vendor will eventually concede further. Compare with example 1.7 to see what changes by recipient.

---

## Section 2 — Email examples

### 2.1 Friendly / general check-in

> Good morning,
>
> I hope you are keeping well.
>
> Please could you provide a quick update on this file? Has the draft contract pack been issued to the other side now?

---

> Good morning,
>
> Hope everybody is well!
>
> I just wanted to quickly check in to see if the initial replies to enquiries had been reviewed yet? And if so, was there anything further to raise or does that conclude enquiries?
>
> Please let me know if you need anything 🙂

---

> Good morning,
>
> Hope you both had a lovely weekend in the sunshine!
>
> @[Name] I just wanted to quickly ask whether the draft contract pack went out to the buyer's solicitor before the weekend? If so, I'll touch base with them to keep things moving 🙂

---

### 2.2 Polite-yet-firm — recoverable slippage

> Hi [Name],
>
> I hope you're well.
>
> I chased the seller's solicitor again yesterday regarding the draft contract pack. They've advised that when they attempted to issue it, they were informed that the buyer's solicitors have not yet been formally instructed.
>
> As you are now instructed by [Name], would you mind urgently contacting [email] and [email] to confirm your instruction and request that the contract pack is issued?
>
> If you could cc me in, that would be really helpful as it gives visibility and allows me to follow up with the seller's solicitor straight away.
>
> Thanks very much in advance.

---

> Good morning [Name],
>
> Hope you are keeping well and had a lovely weekend!
>
> Could you either cc me or let me know once the draft contract pack has been issued please? 🙂

---

### 2.3 Chase up — previous email unanswered

> Good morning,
>
> I hope you are well.
>
> I'm just following up on the below email from Monday. We are not aware of any enquiries being raised yet. Is the plan to raise these before the weekend? We've got some really good momentum on this transaction so ideally would like to keep it going!

---

> Hi [Name],
>
> Re-sent the MOS to you yesterday. Could you let me know if [firm] have confirmed their instruction to the seller's solicitor yet? Ideally would like to get the draft contract pack out before the weekend so next week we're in a good position to crack on!

---

> Good morning all,
>
> Hope everybody is well and had a good weekend.
>
> Just trying to gauge where we are at the start of the week after the price conversations last week.
>
> @[Name] Has the draft contract pack gone out on this file please? And if not, are you waiting on anything?

---

### 2.4 Urgent — exchange date or material progress at genuine risk

> Good morning all,
>
> I hope you are well.
>
> Has there been any correspondence between yourselves in the last 48 hours? This sale has been agreed since 27th February and, as far as we are aware, the draft contract pack is still yet to be issued.
>
> I appreciate there were delays on the buyer's side in fully instructing [firm], due to the arrival of their baby, however we do now need to start moving things forward. At present, it does feel as though we are the only ones actively pushing this along.
>
> I would really appreciate your attention and assistance in progressing matters.

> **Why this works:** This is the firmest tone in the corpus. Note what it does and doesn't do. Does: states the date factually, acknowledges the legitimate reason for delay, names the collective frustration ("the only ones actively pushing"), asks plainly. Does not: blame the recipient personally, threaten, ultimatum, drop the warmth.

---

### 2.5 Final reminder — sustained silence, transaction at risk

> @[Name] Are you able to respond to the emails dated 20th and 23rd May please? Have enquiries been raised on this file?
>
> We would appreciate a response/update.

> **Why this works:** Short, factual, lists the dates of attempted contact, asks the substantive question, closes with a collective "we" statement of expectation. No softening — but no aggression either. The message is plainly that the lack of response is the issue.

---

### 2.6 Diplomatic / pushing back firmly on a position

> Good morning [Name],
>
> I hope you're well and had a lovely bank holiday weekend!
>
> I do understand your concerns here; however, I can assure you it is entirely standard practice for estate agents to communicate and liaise with solicitors on both sides. I'm sure you'll appreciate that I am also listed as the Sales Progressor on the Memorandum of Sale.
>
> Most agencies now have a dedicated sales progressor, as transactions can often involve long periods without updates and, at times, poor communication between parties. Our role is to ensure matters continue moving forward and that all parties remain aligned throughout the process.
>
> Whilst the purchase is of course your own, the transaction is agreed by ourselves with our client, and it is therefore important that we are able to contact both the purchasers and their solicitor in order to stay updated on matters and move things forward where necessary.
>
> I have to say, in almost a decade of managing property sales, I have never known a solicitor to charge for responding to the selling agent. If this is the position your solicitor is taking, this would be unusual and may become problematic as the transaction progresses, as we become an integral part of progressing matters as things move forward.
>
> I'm sure you understand that the updates we pass on to our client (the vendor) need to be confirmed by the professional handling the file, so there will be times where we need to correspond with [Name] to formally confirm key milestones have been reached throughout the process.
>
> You have been very efficient in getting the survey booked and the transaction underway, so thank you for that. However, we will continue to contact [firm] where appropriate to confirm that these important steps have been completed.
>
> @[Name] We are yet to receive formal confirmation that searches are underway. Please may you confirm?

> **Why this works:** Disagreement handled at length, formally, but warmly. Acknowledges the recipient's good behaviour ("very efficient in getting the survey booked"), gives reasoned explanation, ends by closing the substantive matter and pivoting back to the actual progress question. This is not a *generated* tone — it is a real human moment included to show how serious pushback is structured. The model is unlikely to need to produce something this long, but the structure (acknowledge → reason → assert → return to substance) is the template for any disagreement.

---

### 2.7 First contact — purchaser introduction

> Hi [Name],
>
> I hope you're well.
>
> I've just tried to give you a quick call to introduce myself, so I thought I'd drop you a quick email.
>
> I'll be your sales progressor, so I'll be on hand to help keep things moving and make sure everything stays on track.
>
> I've just sent you a password reset link for our portal. If you're able to log in and tick off any milestones that have already been completed, that would be really helpful.
>
> Once everything is updated (aside from the draft contract pack), I'll follow up with your solicitor to get that issued out to the buyer's solicitor for review.
>
> The buyers are almost finished with their onboarding, so by the time the draft contract pack is issued, they should be in a position to proceed with searches and raising enquiries straight away.
>
> If you need anything from me in the meantime, please don't hesitate to get in touch on Whatsapp ([phone]).

---

## Section 3 — Patterns to take from these examples

The following patterns are present across virtually every message above. They are encoded as rules in the spec; this list is a quick reference.

**Opening pattern.**
- Greeting + first name (where known) + "Hope you're well" or context-aware variant.
- WhatsApp: shorter ("Morning [Name],"). Email: more structured ("Good morning,").
- The greeting is never skipped, even on terse messages.

**Framing.**
- The progressor is doing work in the background. The recipient is being kept informed or being asked to do their part of the joint effort.
- Never frames the recipient as the obstacle, even when they are.
- When time pressure is real, surfaces the *shared* stake (exchange date, momentum, the chain) — not blame.

**Word-level signals.**
- "Just" is the most distinctive single word: "just wanted to," "just a quick," "just chasing," "just checking." Used multiple times per message in many cases.
- Soft modals: "would you be able to," "could you," "would you mind," "if you get a chance."
- Volunteers help: "I'll chase them," "happy to follow up if it helps," "let me know and I'll handle it."
- Explains the *why* of any ask: "just so I can update the portal," "just helps us keep things moving."

**Closing pattern.**
- Open door: "let me know if you need anything," "here to help if you need anything at all."
- WhatsApp: rarely formally signed off; sometimes "Have a lovely weekend!" trails the message.
- Email: "Best regards, [Name] @ [firm]" or "Kind regards" — not always present, especially on briefer follow-ups.

**Emoji usage.**
- 🙂 is the most common, used to close warm or routine messages.
- 🙏🏼 🤝🏻 🙌🏼 ✌🏼 🌞 🤞🏻 are used with restraint, usually one per message.
- 😄 / 😁 appear only in genuinely light contexts. Never in firm or escalated messages.
- Urgent and Final Reminder messages use no emoji.

**Length norms.**
- WhatsApp: 50–80 words typical. Two to four short paragraphs.
- Email: 80–150 words typical. Three to five short paragraphs.
- Both stretch longer when conveying genuine context (negotiations, complex updates) — but the default is brief.

**What's never present.**
- "We're stuck waiting on your side" or any blame framing.
- "You need to" / "you must" / "you have to."
- "If this isn't sorted by X, then Y" — no ultimatums.
- "As discussed" used to imply prior wrongdoing.
- "Can you get this sorted today" — too imperative.
- Corporate hedging like "I'm reaching out because…" — not the voice.

---

## Section 4 — How to use this corpus when prompting

When a future engineer or model needs to write or refine a chase prompt:

1. Read Section 3 first. It's the pattern summary in plain English.
2. Pick the example in Sections 1–2 that's closest to the situation being chased.
3. Compare the candidate output to that example. Does it differ in voice, length, framing, or word choice? If yes, the candidate is wrong somewhere.
4. The examples are the source of truth for *voice*. The spec (`PROMPT_SPEC.md`) is the source of truth for *rules*. They don't conflict — the spec encodes what these examples have in common.

---

*End of corpus.*
