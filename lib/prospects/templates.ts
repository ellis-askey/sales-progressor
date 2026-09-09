// Preset follow-up templates for prospect outreach. Pure (no server imports) so
// the compose picker can list them client-side; the fill happens server-side in
// draftFollowUpAction with real prospect context. Body is plain text; the
// signature is appended automatically at send time. No em dashes (Law 21).

export type TemplateCtx = { firstName: string; agencyName: string; senderName: string };

export type FollowUpTemplate = {
  key: string;
  label: string;
  build: (c: TemplateCtx) => { subject: string; body: string };
};

const hi = (c: TemplateCtx) => (c.firstName ? `Hi ${c.firstName},` : "Hi,");

export const FOLLOWUP_TEMPLATES: FollowUpTemplate[] = [
  {
    key: "cold_intro",
    label: "Cold introduction",
    build: (c) => ({
      subject: `Sales progression for ${c.agencyName}`,
      body: `${hi(c)}\n\nI run The Sales Progressor. We’ve spent the last few years building software around how property transactions actually progress, with one goal: helping agents get more of their agreed sales through to exchange.\n\nIt’s completely free for agents to use themselves. It tracks what’s happening across each sale, flags where things are starting to stall and gives you a live prediction of when your exchanges are likely to land, rather than relying on guesswork.\n\nAnd if you’d rather not progress a sale yourself, you can simply hand it to us and we’ll do it for you.\n\nWould you be open to trying it with a live sale at ${c.agencyName}?\n\nBest,`,
    }),
  },
  {
    key: "no_response",
    label: "No response yet",
    build: (c) => ({
      subject: `Following up - ${c.agencyName}`,
      body: `${hi(c)}\n\nJust floating this back to the top of your inbox.\n\nThere’s no trial or subscription with The Sales Progressor. The software is completely free, so you can add a live sale and see what’s outstanding, where it’s starting to stall and when it’s currently predicted to exchange.\n\nThe idea is simply to give the team a much clearer view of the pipeline and catch problems earlier, before they put an agreed sale at risk.\n\nAnd if you’d rather take the progression off the team altogether, you can hand the file to us instead.\n\nWorth trying it on one?\n\nBest,`,
    }),
  },
  {
    key: "after_call",
    label: "After a phone call",
    build: (c) => ({
      subject: `Great to speak — next steps`,
      body: `${hi(c)}\n\nGood to talk earlier. As promised, here is a quick recap: we handle the progression and chasing so your team can focus on listing and selling.\n\nShall we trial it on one of your live sales this week? I will set everything up.\n\nBest,\n${c.senderName}`,
    }),
  },
  {
    key: "interested_not_ready",
    label: "Interested, not ready",
    build: (c) => ({
      subject: `Whenever the timing suits`,
      body: `${hi(c)}\n\nNo rush at all. When you are ready to take a look, the offer stands: one live sale, fully run by us, so you can judge it on real results rather than a pitch.\n\nI will check back in a little while. In the meantime, shout if anything changes at ${c.agencyName}.\n\nBest,\n${c.senderName}`,
    }),
  },
  {
    key: "pricing_checkin",
    label: "Check-in after pricing",
    build: (c) => ({
      subject: `Any questions on the pricing?`,
      body: `${hi(c)}\n\nHope the pricing made sense. The short version: we only charge when a sale exchanges, so it lines up with your own success.\n\nHappy to walk through the numbers for ${c.agencyName} specifically. Want me to?\n\nBest,\n${c.senderName}`,
    }),
  },
  {
    key: "re_engage",
    label: "Re-engagement",
    build: (c) => ({
      subject: `Still worth a look?`,
      body: `${hi(c)}\n\nOne last nudge from me.\n\nWe built The Sales Progressor because far too many agreed sales still fall through unnecessarily. By the time it becomes obvious that a transaction has stalled, weeks can already have been lost.\n\nThe software is free for agents to use and is designed to flag those problems earlier, keep the progression moving and give you a much better idea of which exchanges are actually coming.\n\nIf you fancy giving it a go, add one live sale and see what you think. Or send it our way and we can progress it for you.\n\nBest,`,
    }),
  },
];

export const TEMPLATE_OPTIONS = FOLLOWUP_TEMPLATES.map((t) => ({ key: t.key, label: t.label }));

export function buildTemplate(key: string, ctx: TemplateCtx): { subject: string; body: string } | null {
  const t = FOLLOWUP_TEMPLATES.find((x) => x.key === key);
  return t ? t.build(ctx) : null;
}
