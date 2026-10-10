// The portal-invite email body. Extracted from app/api/portal/invite/route.ts
// (2026-09-08) so it can be rendered by the Command Centre Email Catalogue and
// unit-tested, and so the route stays thin. Behaviour is identical to the
// previous inline markup — the agency brand theme (coral default) themes the
// hero band + button, the logo band sits above the hero.

import { preheader } from "@/lib/email/preheader";
import { emailHeroBand, emailButton, type EmailTheme } from "@/lib/email/brand-theme";
import { renderStudioEmail } from "@/lib/email/studio-render";
import type { StudioTheme } from "@/lib/email/email-theme-studio";

export function buildPortalInviteEmail(opts: {
  agencyName: string;
  address: string;
  saleWord: string; // "sale" | "purchase"
  greeting: string;
  portalUrl: string;
  theme: EmailTheme;
  logoBand?: string;
  studioTheme?: StudioTheme;
  identityName?: string;
  logoUrl?: string | null;
  tileColor?: string | null;
}): { subject: string; text: string; html: string } {
  const { agencyName, address, saleWord, greeting, portalUrl, theme, logoBand = "", studioTheme, identityName, logoUrl, tileColor } = opts;

  const subject = `Your ${saleWord} portal: ${address}`;

  const text = [
    greeting,
    "",
    `You can now track the progress of your ${saleWord} at ${address} using the link below.`,
    "",
    `Your portal: ${portalUrl}`,
    "",
    "This link is personal to you, so please don't share it with others.",
    "",
    agencyName,
  ].join("\n");

  // Customised agency/business → full studio render; default keeps legacy below.
  if (studioTheme && identityName) {
    const html = renderStudioEmail(studioTheme, {
      eyebrow: address,
      headline: `Your ${saleWord} portal is ready`,
      greeting,
      blocks: [{ html: `You can now track the progress of your ${saleWord} online. Check in any time to see what's been completed, what's coming next, and get updates from your team.` }],
      cta: { label: "Open my portal", url: portalUrl },
      trailingHtml: `<p style="margin:0;font-size:12px;color:#6b7280">This link is personal to you, so please don't share it with others. You can bookmark it and return any time.</p>`,
      preheaderText: `Follow every step of your ${saleWord} in one place, whenever you want to check.`,
    }, { identityName, logoUrl: logoUrl ?? null, tileColor: tileColor ?? null });
    return { subject, text, html };
  }

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">${preheader(`Follow every step of your ${saleWord} in one place, whenever you want to check.`)}${logoBand}
${emailHeroBand({ theme, eyebrow: agencyName, headline: address, subline: `Your ${saleWord} portal is ready` })}
<div style="padding:32px">
  <p style="margin:0 0 16px;font-size:15px">${greeting}</p>
  <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4a5162">
    You can now track the progress of your ${saleWord} online. Check in any time to see what's been completed, what's coming next, and get updates from your team.
  </p>
  <p style="margin:0 0 32px">${emailButton({ theme, href: portalUrl, label: "Open my portal" })}</p>
  <div style="padding:14px 16px;background:#F8F9FB;border-radius:10px;margin-bottom:24px">
    <p style="margin:0;font-size:12px;color:#8b91a3">
      This link is personal to you, so please don't share it with others. You can bookmark it and return any time.
    </p>
  </div>
  <p style="margin:0;font-size:12px;color:#8b91a3">${agencyName}</p>
</div>
</body></html>`;

  return { subject, text, html };
}
