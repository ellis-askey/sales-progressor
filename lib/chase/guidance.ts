// Shared chase-drafting guidance strings.
//
// Extracted from app/api/ai/generate-chase/route.ts so the neighbour-agent chase
// route (app/api/ai/generate-neighbour-chase) reuses the SAME tone + channel
// voice rather than duplicating it. The client/solicitor chase route imports
// these back — behaviour is unchanged (same strings).
//
// Prompt strings are verbatim from app/api/ai/generate-chase/PROMPT_SPEC.md
// §5 and §6 — do not edit here; edit the spec first.

export const TONE_KEY_MAP: Record<string, string> = {
  "Friendly": "friendly",
  "Professional": "professional",
  "Polite Yet Firm": "polite_yet_firm",
  "Chase Up": "chase_up",
  "Urgent": "urgent",
  "Final Reminder": "final_reminder",
};

export const CHANNEL_GUIDANCE: Record<string, string> = {
  whatsapp: `This is a WhatsApp message. Keep it brief: 50 to 80 words is the target, three short paragraphs maximum. Opener is shorter and more informal than email, so "Morning [Name]," or "Hi [Name]," or "Good morning [Name]," (no "Dear"). No formal sign-off; end with the open-door line or trail off naturally. One emoji is fine for lighter tones.`,
  email: `This is an email. Length: 80 to 150 words, three to five short paragraphs. Opener is more structured than WhatsApp: "Good morning," or "Hi [Name],". Follow with "Hope you're well" or a context-aware variant. If multiple parties are addressed, use @Name mentions to direct specific questions. Sign off with "Best regards, {senderFirstName}" or "Kind regards, {senderFirstName}", choosing to fit the tone band.`,
};

export const TONE_GUIDANCE: Record<string, string> = {
  friendly: `Friendly tone. Use this when there's no time pressure, the recipient has been responsive recently, or you're checking in for rapport. Lean into warmth, with a context-aware opener ("hope you had a lovely weekend"), one emoji at the end, genuinely conversational. No urgency cues.`,
  professional: `Professional tone. Use this for first contact with a new party, or when the message will be seen by multiple cc'd parties. Keep all the warmth (the opener, the "just," the open-door close), but drop playful touches. Slightly more neutral phrasing throughout. Fully on-voice, just calmer.`,
  polite_yet_firm: `Polite-yet-firm tone. Use this when a milestone has slipped past its expected date but the situation is recoverable, and one prior chase has gone unanswered. Name the slippage factually with a date if available ("I emailed on the 23rd just to check on this"), acknowledge possible reasons gracefully ("I know things have been busy"), then restate the ask plainly. End warmly. Never blame.`,
  chase_up: `Chase-up tone. Use this when a previous message has gone unanswered for several days and a fresh nudge is needed. Reference the previous correspondence ("just following up on the below" or "circling back on the message I sent on the X"). Keep it short. This is a nudge, not a fresh ask. Ask one clear question. Open-door close is essential.`,
  urgent: `Urgent tone. No emoji whatsoever, not even one. No exclamation marks. Use this when the exchange date or another hard deadline is genuinely at risk. Open by surfacing the SHARED goal ("we're aiming for exchange on {expectedExchangeDate}, so I'm just trying to tie up the last few bits this week"). Then explain factually what's outstanding. Then ask plainly for the action. Then volunteer to do your part: "once X is in I can push everything through with the solicitor." Tone stays warm. Urgency comes from the deadline, not pressure on the recipient. Sign off with name and firm.`,
  final_reminder: `Final-reminder tone. Use this when multiple chases over a sustained period have gone unanswered and the transaction is at material risk. Name the timeline of attempted contact factually and without accusation ("I've sent messages on the 14th, 21st and 28th"). State the consequence plainly and as a SHARED outcome ("if I don't hear back this week, I'll need to update the chain that we may not make exchange on the {expectedExchangeDate}"). Still no blame. The message is "I want to avoid this together." Sign off professionally with full name and firm.`,
};

// Who the message is going TO shapes how much you explain and how long it runs.
// A solicitor runs these steps daily, so explaining the process reads as talking
// down to them; a client (buyer/seller) may not follow it, so a light "why" helps.
export const RECIPIENT_GUIDANCE: Record<"solicitor" | "client", string> = {
  solicitor: `You are writing to a solicitor: a conveyancing professional who runs these steps every day. Be brief and direct. Make the ask and stop. Do NOT explain what the step is, what happens next, or why it matters, and never narrate the process (no "so the buyer's side can then begin their review" clauses). They already know all of it, and spelling it out reads as talking down to them. Keep a short greeting, a "just", and a brief open-door line, but trim everything else. Keep it shorter than a client message: two to four short sentences of substance is plenty. This brevity takes precedence over the channel word count.`,
  client: `You are writing to a member of the public (the buyer or seller), who may not follow the conveyancing process. One short clause on why the ask helps is welcome and reassuring. Keep it warm, plain, and free of legal jargon.`,
};

// The neighbour-agent chase: you are writing agent-to-agent, to the estate agent
// handling the property directly above or below in the chain. They are a fellow
// professional, so keep it brief, warm and collegiate — a peer asking a peer for
// a quick status update on their side of the chain. Do NOT explain conveyancing;
// they run it daily. No pressure, no blame; you are on the same side, both trying
// to keep the chain moving.
export const AGENT_RECIPIENT_GUIDANCE = `You are writing to a fellow estate agent — the agent handling the property directly above or below this sale in the property chain. Write agent-to-agent, peer to peer: brief, warm, and collegiate. You are simply asking for a quick update on where their side of the chain is up to, so both of you can keep the whole chain moving. Do NOT explain the conveyancing process; they run it every day. Make the ask plainly and stop. No blame, no pressure: you are on the same side. Two to four short sentences of substance is plenty.`;
