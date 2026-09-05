// Morning brief ("Here's what needs you") — the agent's daily digest of files
// that need action, grouped into needs-attention / due-today / coming-up.
// Redesigned into the lifecycle email family. The greeting + figures are overlaid
// on the image on desktop and baked into the image on mobile. Each file shows its
// property photo (or a house placeholder), its outstanding items and a status pill.
import { EMAIL_ASSET, FONT_STACK, emailHead, emailHeaderRow, pageFooter } from "./retention";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type DigestItem = { label: string; detail?: string };
type DigestFile = {
  addressLine1: string; // street, e.g. "8 Birchwood Close"
  addressLine2?: string; // town + postcode, e.g. "Guildford, GU1 3RF"
  url: string;
  photoUrl?: string;
  items: DigestItem[];
};
type DigestGroup = { kind: "attention" | "today" | "upcoming"; count: number; files: DigestFile[] };

// Card header band: a gradient (deeper tone at the foot) plus a tone-tinted
// hairline, so the headers read with depth instead of a flat wash.
const SECTION = {
  attention: { icon: "icon-warn-red.png", title: "Needs attention", sub: (_c: number) => "Chases overdue", band: "linear-gradient(180deg,#FEECEC 0%,#F8D4D3 100%)", bandBorder: "#F2C3C2", accent: "#D93A3F", bullet: "#D93A3F" },
  today: { icon: "icon-clip-amber.png", title: "Due today", sub: (c: number) => (c === 1 ? "Action due today" : "Actions due today"), band: "linear-gradient(180deg,#FEF5E8 0%,#FBE3BC 100%)", bandBorder: "#F3D6A2", accent: "#C0820B", bullet: "#E59218" },
  upcoming: { icon: "icon-cal-green.png", title: "Coming up", sub: (_c: number) => "Keep an eye on these", band: "linear-gradient(180deg,#EEF7EF 0%,#D6ECDB 100%)", bandBorder: "#C6E4CC", accent: "#2E9E5B", bullet: "#2E9E5B" },
} as const;

function renderFile(f: DigestFile, meta: (typeof SECTION)[keyof typeof SECTION], isFirst: boolean): string {
  // Photo (if on file) in a circle; otherwise the illustrated street placeholder,
  // also in a circle.
  const src = f.photoUrl ? f.photoUrl.replace(/"/g, "&quot;") : `${EMAIL_ASSET}/house-placeholder.png`;
  const photo = `<img src="${src}" width="56" height="56" alt="" style="display:block;border:0;width:56px;height:56px;border-radius:50%;object-fit:cover;">`;
  // The detail (e.g. the green exchange date) sits inline on desktop and drops
  // onto its own line under the label on a phone (.idet / .isep rules).
  const items = f.items
    .map(
      (it) =>
        `<div style="margin-top:7px;font-family:${FONT_STACK};font-size:13.5px;line-height:1.4;"><span style="color:${meta.bullet};">&#8226;</span> <span style="color:#1a1d29;font-weight:600;">${escapeHtml(it.label)}</span>${it.detail ? `<span class="isep" style="color:#c7ccd6;"> &middot; </span><span class="idet" style="color:${meta.accent};font-weight:700;">${escapeHtml(it.detail)}</span>` : ""}</div>`,
    )
    .join("");
  // Address: line 1 bold, town + postcode small and lighter underneath (app
  // style). No pill — the address spans the full width in every section.
  const addrLine1 = `<div style="font-family:${FONT_STACK};font-size:15.5px;font-weight:800;color:#0F1B2D;line-height:1.3;">${escapeHtml(f.addressLine1)}</div>`;
  const addrLine2 = f.addressLine2 ? `<div style="font-family:${FONT_STACK};font-size:13px;font-weight:500;color:#8a93a3;line-height:1.4;margin-top:2px;">${escapeHtml(f.addressLine2)}</div>` : "";
  return `<a href="${f.url}" style="text-decoration:none;display:block;"><div style="padding:16px 18px;${isFirst ? "" : "border-top:1px solid #F0F1F4;"}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="top" width="68">${photo}</td>
      <td valign="top" style="padding-left:12px;">
        ${addrLine1}${addrLine2}
        ${items}
      </td>
      <td valign="middle" align="right" width="18" style="padding-left:8px;"><img src="${EMAIL_ASSET}/icon-chevron.png" width="9" height="15" alt="" style="display:block;border:0;"></td>
    </tr></table>
  </div></a>`;
}

function renderSection(g: DigestGroup, openUrl: string): string {
  const meta = SECTION[g.kind];
  const rows = g.files.map((f, i) => renderFile(f, meta, i === 0)).join("");
  // If the header count exceeds the rows shown, surface the remainder rather
  // than silently hiding it.
  const moreN = g.count - g.files.length;
  const moreRow = moreN > 0
    ? `<a href="${openUrl}" style="text-decoration:none;display:block;border-top:1px solid #F0F1F4;padding:13px 18px;text-align:center;font-family:${FONT_STACK};font-size:13.5px;font-weight:700;color:#FF6B4A;">and ${moreN} more &rarr;</a>`
    : "";
  return `<div style="border:1px solid #EEF0F3;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,0.04);">
    <div style="background:${meta.band};border-bottom:1px solid ${meta.bandBorder};padding:14px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" width="52"><img src="${EMAIL_ASSET}/${meta.icon}" width="42" height="42" alt="" style="display:block;border:0;"></td>
        <td valign="middle" style="padding-left:12px;">
          <div style="font-family:${FONT_STACK};font-size:16px;font-weight:800;color:#0F1B2D;">${meta.title} (${g.count})</div>
          <div style="font-family:${FONT_STACK};font-size:13px;color:#8a93a3;margin-top:1px;">${meta.sub(g.count)}</div>
        </td>
      </tr></table>
    </div>
    <div style="background:#ffffff;">${rows}${moreRow}</div>
  </div>`;
}

export function buildMorningBrief(vars: {
  firstName: string;
  activeSales: number;
  actionsDue: number;
  groups: DigestGroup[];
  openUrl: string;
  unsubscribeUrl?: string;
}): { subject: string; html: string; text: string } {
  const firstName = escapeHtml(vars.firstName.trim());
  const subject = vars.actionsDue > 0 ? `${vars.actionsDue} action${vars.actionsDue !== 1 ? "s" : ""} need you today` : "Your files today";

  const heroCopy = `<h1 class="hl" style="margin:0;font-family:${FONT_STACK};font-size:32px;line-height:1.12;font-weight:800;color:#0F1B2D;letter-spacing:-0.7px;">Morning, ${firstName}.<br>Here’s what <span style="color:#FF6B4A;">needs you.</span></h1>
    <p style="margin:12px 0 0;font-family:${FONT_STACK};font-size:16px;font-weight:600;color:#8a93a3;">${vars.activeSales} active sales <span style="color:#c7ccd6;">&middot;</span> <span style="color:#FF6B4A;font-weight:700;">${vars.actionsDue} actions due</span></p>`;

  const heroDesktop = `<div class="hero-desk" style="background-color:#FDF1EA;background-image:url('${EMAIL_ASSET}/hero-digest-desktop.png');background-repeat:no-repeat;background-size:cover;background-position:right center;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="hero-text" width="58%" valign="top" style="padding:30px 8px 0 34px;">${heroCopy}</td>
      <td width="42%">&nbsp;</td>
    </tr></table>
  </div>`;

  const heroMobile = `<div class="hero-mob" style="display:none;background-color:#ffffff;">
    <img src="${EMAIL_ASSET}/hero-digest-mobile.png" alt="Here’s what needs you." style="display:block;width:100%;max-width:100%;border:0;">
  </div>`;

  const sections = vars.groups
    .filter((g) => g.files.length > 0)
    .map((g) => `<tr><td style="padding:16px 0 0;">${renderSection(g, vars.openUrl)}</td></tr>`)
    .join("");

  const body =
    sections +
    `<tr><td style="padding:26px 0 0;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${vars.openUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Open today’s work  &rarr;</a>
      </div>
    </td></tr>` +
    pageFooter(vars.unsubscribeUrl);

  const html = `<!DOCTYPE html><html lang="en">${emailHead()}<body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;"><tr><td align="center" style="padding:24px 14px 22px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #EAE6E1;box-shadow:0 6px 26px rgba(17,24,39,0.07);">
        <tr><td class="px" style="padding:30px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${emailHeaderRow("A simpler, better way<br>to progress property sales.", 10)}</table>
        </td></tr>
        <tr><td style="padding:0;">${heroDesktop}${heroMobile}</td></tr>
        <tr><td class="px" style="padding:8px 34px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const textLines: string[] = [
    `Morning, ${vars.firstName.trim()}.`,
    `${vars.activeSales} active sales, ${vars.actionsDue} actions due.`,
    ``,
  ];
  for (const g of vars.groups.filter((g) => g.files.length > 0)) {
    textLines.push(`${SECTION[g.kind].title} (${g.count}):`);
    for (const f of g.files) {
      const addr = [f.addressLine1, f.addressLine2].filter(Boolean).join(", ");
      textLines.push(`  ${addr}`);
      for (const it of f.items) textLines.push(`    - ${it.label}${it.detail ? ` (${it.detail})` : ""}`);
    }
    textLines.push(``);
  }
  textLines.push(`Open today's work: ${vars.openUrl}`, ``, `TSP · Sales Progressor`, `A simpler, better way to progress property sales.`);
  if (vars.unsubscribeUrl) textLines.push(``, `Don’t want these emails? ${vars.unsubscribeUrl}`);

  return { subject, html, text: textLines.join("\n") };
}
