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
      body: `${hi(c)}\n\nI run The Sales Progressor. We take the chasing and progression work off estate agents so more sales exchange, faster, without the day to day admin.\n\nWould you be open to a quick look at how it would work for ${c.agencyName}? Happy to run one of your live sales through it so you can see it in action, no commitment.\n\nBest,\n${c.senderName}`,
    }),
  },
  {
    key: "no_response",
    label: "No response yet",
    build: (c) => ({
      subject: `Following up — ${c.agencyName}`,
      body: `${hi(c)}\n\nJust floating this back to the top of your inbox. I know how busy a sales floor gets.\n\nIf it helps, I can show you the difference on a single live file with no setup on your side. Worth a five minute look?\n\nBest,\n${c.senderName}`,
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
      body: `${hi(c)}\n\nIt has been a while, so I wanted to check whether progression is still a headache worth solving at ${c.agencyName}.\n\nWe have made the trial even simpler since we last spoke. One live sale, run entirely by us. Fancy giving it a go?\n\nBest,\n${c.senderName}`,
    }),
  },
];

export const TEMPLATE_OPTIONS = FOLLOWUP_TEMPLATES.map((t) => ({ key: t.key, label: t.label }));

export function buildTemplate(key: string, ctx: TemplateCtx): { subject: string; body: string } | null {
  const t = FOLLOWUP_TEMPLATES.find((x) => x.key === key);
  return t ? t.build(ctx) : null;
}
