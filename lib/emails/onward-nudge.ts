// The onward/related-sale nudge emails (critique h3xwf6). An agency asks a client
// to set up, or update, the tracking of their OTHER move in their portal:
//   - direction "onward"  → the SELLER's onward purchase (they're buying on)
//   - direction "related" → the BUYER's own sale (they're also selling)
// and mode "setup" (first time) or "update" (keep it current).
//
// Branded like buildClientUpdateEmail (agency eyebrow + colour CTA). The CTA
// deep-links to the onward panel the client already has in their portal. Voice:
// British, warm, no dashes, no exclamation marks, never "the system"/"automatically".
// Copy here is the DEFAULT; the agency can edit it via the automated-emails editor.

export type OnwardNudgeDirection = "onward" | "related";
export type OnwardNudgeMode = "setup" | "update";

// The agency-editable pieces of a nudge (noun stays code-side — it's woven into
// prose, not free text). Matches the onward_nudge template family in
// lib/agency-email/templates.ts.
export type OnwardNudgeCopy = { subject: string; lead: string; body: string; cta: string };

type Copy = OnwardNudgeCopy & { noun: string };

// noun = how we name their other move in prose ("onward purchase" / "sale").
const COPY: Record<`${OnwardNudgeDirection}_${OnwardNudgeMode}`, Copy> = {
  onward_setup: {
    noun: "onward purchase",
    subject: "Let's keep your onward purchase on track",
    lead: "Alongside your sale, we can keep track of your onward purchase in one place, so we can both see where the move is up to.",
    body: "Set it up in your portal and you can mark off each step as it happens. We'll see it on our side and help keep things moving.",
    cta: "Set up my onward purchase",
  },
  onward_update: {
    noun: "onward purchase",
    subject: "A quick check-in on your onward purchase",
    lead: "Just checking in on your onward purchase.",
    body: "If anything has moved since we last heard, pop into your portal and update where it's up to. It helps us keep the whole chain moving.",
    cta: "Update my onward purchase",
  },
  related_setup: {
    noun: "sale",
    subject: "Let's keep your sale on track",
    lead: "Alongside your purchase, we can keep track of your own sale in one place, so we can both see where things stand.",
    body: "Set it up in your portal and you can mark off each step as it happens. We'll see it on our side and help keep things moving.",
    cta: "Set up my sale",
  },
  related_update: {
    noun: "sale",
    subject: "A quick check-in on your sale",
    lead: "Just checking in on your own sale.",
    body: "If anything has moved since we last heard, pop into your portal and update where it's up to. It helps keep everything moving on both sides.",
    cta: "Update my sale",
  },
};

// The built-in default copy for a variant (noun dropped — see OnwardNudgeCopy).
// The onward_nudge template family seeds its platform defaults from here.
export function onwardNudgeDefaultCopy(direction: OnwardNudgeDirection, mode: OnwardNudgeMode): OnwardNudgeCopy {
  const { subject, lead, body, cta } = COPY[`${direction}_${mode}`];
  return { subject, lead, body, cta };
}

export function buildOnwardNudgeEmail(opts: {
  agencyName: string;
  greeting: string; // e.g. "Good morning Neil,"
  direction: OnwardNudgeDirection;
  mode: OnwardNudgeMode;
  propertyAddress?: string | null; // the onward/related property, when known
  portalUrl: string; // deep-link to the portal onward panel
  theme: { buttonBg: string; buttonText: string };
  // Agency override (from resolveOnwardNudgeContent). Each field wins only when
  // non-empty, else the built-in default for the variant applies.
  copy?: Partial<OnwardNudgeCopy>;
}): { subject: string; text: string; html: string } {
  const { agencyName, greeting, direction, mode, propertyAddress, portalUrl, theme, copy } = opts;
  const base = COPY[`${direction}_${mode}`];
  const c: Copy = {
    noun: base.noun,
    subject: copy?.subject?.trim() || base.subject,
    lead: copy?.lead?.trim() || base.lead,
    body: copy?.body?.trim() || base.body,
    cta: copy?.cta?.trim() || base.cta,
  };
  const nounWithAddr = propertyAddress ? `${c.noun} at ${propertyAddress}` : c.noun;
  // Weave the address into the lead's first mention of the noun, when we have it.
  const lead = propertyAddress ? c.lead.replace(c.noun, nounWithAddr) : c.lead;

  const text = [
    greeting,
    "",
    lead,
    "",
    c.body,
    "",
    `${c.cta}: ${portalUrl}`,
    "",
    `You're receiving this from ${agencyName} because you have a move in progress with us.`,
  ].join("\n");

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 20px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${theme.buttonBg}">${agencyName}</p>
<p style="margin:0 0 16px;font-size:15px">${greeting}</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${lead}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6">${c.body}</p>
<p style="margin:0 0 24px"><a href="${portalUrl}" style="display:inline-block;background:${theme.buttonBg};color:${theme.buttonText};padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">${c.cta}</a></p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#4a5162">Rather tell us directly? Just reply to this message and we'll update it for you.</p>
<p style="margin:24px 0 0;font-size:12px;color:#8b91a3">You're receiving this from ${agencyName} because you have a move in progress with us.</p>
</body></html>`;

  return { subject: c.subject, text, html };
}
