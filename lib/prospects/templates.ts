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
      subject: `Progression for ${c.agencyName}`,
      body: `${hi(c)}\n\nHope you're well.\n\nI thought this might be useful for you and the team at ${c.agencyName}.\n\nThe Sales Progressor is free for agents to use and looks after the progression side once a sale is agreed. It keeps buyers and sellers updated, chases the outstanding bits with the solicitors, and gives you a clear view of where every sale is up to. We also use real transaction data to predict when each one is likely to exchange.\n\nAnd if you ever get stretched, you can hand a sale over to us and we'll progress it for you, while you keep full visibility.\n\nIf you'd like a proper look, I'd be happy to show you around.\n\nBest,`,
    }),
  },
  {
    key: "no_response",
    label: "No response yet",
    build: (c) => ({
      subject: `Following up, ${c.agencyName}`,
      body: `${hi(c)}\n\nJust floating this back to the top of your inbox.\n\nThe platform is free for agents to use, so you can add a live sale and see where it's up to, what's outstanding and when it's currently predicted to exchange. No trial and no subscription.\n\nAnd if you'd rather take the progression off the team's hands, you can hand the file to us instead.\n\nDo you think it's worth a look for you or the team?\n\nBest,`,
    }),
  },
  {
    key: "after_call",
    label: "After a phone call",
    build: (c) => ({
      subject: `Great to speak, next steps`,
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
      body: `${hi(c)}\n\nHope the pricing made sense. We only charge when a sale exchanges, so it lines up with your own success.\n\nHappy to walk through the numbers for ${c.agencyName} specifically. Want me to?\n\nBest,\n${c.senderName}`,
    }),
  },
  {
    key: "re_engage",
    label: "Re-engagement",
    build: (c) => ({
      subject: `One more from me, ${c.agencyName}`,
      body: `${hi(c)}\n\nLast nudge from me, then I'll leave you be.\n\nIf keeping on top of progression is eating into the day, TSP might help. It chases the solicitors, keeps buyers and sellers updated, and gives you a live read on when each sale is likely to exchange. It's free for agents to use, and if you'd rather, we can take a file on and progress it for you.\n\nIf you fancy giving it a go, I'd be happy to set you up on one live sale so you can see what you think.\n\nBest,`,
    }),
  },
];

export const TEMPLATE_OPTIONS = FOLLOWUP_TEMPLATES.map((t) => ({ key: t.key, label: t.label }));

export function buildTemplate(key: string, ctx: TemplateCtx): { subject: string; body: string } | null {
  const t = FOLLOWUP_TEMPLATES.find((x) => x.key === key);
  return t ? t.build(ctx) : null;
}
