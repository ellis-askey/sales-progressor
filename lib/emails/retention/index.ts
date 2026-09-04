/**
 * Retention email templates for Sales Progressor.
 *
 * Six email keys:
 *   activation_day_1      — day 1 after signup, no transactions
 *   stuck_day_3           — 3+ days, no milestone confirmations
 *   first_exchange        — celebration on first exchange
 *   quiet_30d             — 30 days of inactivity
 *   send_to_us_drop_21d   — "Rachel" email, outsourced user gone quiet
 *   last_touch_60d        — final pause email
 *
 * Footer rules:
 *   - Emails 1, 2, 3 (activation_day_1, stuck_day_3, first_exchange): NO unsubscribe footer — transactional
 *   - Emails 4, 5, 6 (quiet_30d, send_to_us_drop_21d, last_touch_60d): MUST include unsubscribe footer
 *
 * All emails: reply-to inbox@thesalesprogressor.co.uk
 * Email 5 only: sender display name "Rachel — Sales Progressor"
 */

export type RetentionEmailResult = {
  subject: string;
  html: string;
  text: string;
  /** Display name for the "from" field, e.g. "Sales Progressor" or "Rachel — Sales Progressor" */
  fromDisplayName: string;
};

// Pre-formatted property-card fields for stuck_day_3 (the service does the DB
// read + formatting; the template only lays them out). photoUrl is the file's
// own photo (long-lived signed URL) or the hosted fallback.
export type PropertyCardVars = {
  addressLine: string;
  town: string;
  postcode: string;
  photoUrl: string;
  saleLabel: string; // "Sale" (price) or "Purchase" (method fallback)
  saleValue: string; // "£525,000" or "Cash" / "Mortgage"
  tenure: string;    // "Freehold" / "Leasehold"
  added: string;     // "3 Jun 2025"
};

type TemplateVars = {
  firstName: string;
  address?: string;
  ctaUrl?: string;
  unsubscribeUrl?: string;
  property?: PropertyCardVars;
};

// ─── HTML wrapper ─────────────────────────────────────────────────────────────

function buildHtmlWrapper(bodyContent: string, footerContent?: string): string {
  const footer = footerContent
    ? `<p style="margin:24px 0 0;font-size:12px;color:#8b91a3">${footerContent}</p>`
    : "";
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">${bodyContent}${footer}</body></html>`;
}

function ctaButton(label: string, url: string): string {
  return `<p style="margin:20px 0"><a href="${url}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:14px 32px;border-radius:14px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 16px rgba(255,107,74,0.35)">${label}</a></p>`;
}

function unsubscribeFooterHtml(unsubscribeUrl: string): string {
  return `Don't want to hear from us? <a href="${unsubscribeUrl}" style="color:#3b82f6">Unsubscribe from these emails</a>. You'll still get updates on your active sales.`;
}

function unsubscribeFooterText(unsubscribeUrl: string): string {
  return `Don't want to hear from us? Unsubscribe from these emails: ${unsubscribeUrl}\nYou'll still get updates on your active sales.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redesigned lifecycle emails (2026-09). Illustrated hero as a hosted PNG, the
// rest as bulletproof table HTML so the copy stays real text. Assets live in
// /public/emails and are served from the prod host. Matches the "New emails"
// mocks. Being rolled out one template at a time (email 1: last_touch_60d).
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_ASSET = "https://portal.thesalesprogressor.co.uk/emails";
const FONT_STACK = "'Hanken Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";

function emailHead(): string {
  return `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><style>
    a{text-decoration:none;}
    @media only screen and (max-width:480px){
      .shell{padding:24px 20px 14px !important;}
      .hl{font-size:27px !important;letter-spacing:-0.5px !important;}
      .fcol{width:100% !important;max-width:100% !important;border-left:0 !important;padding:0 0 22px 0 !important;}
      .fcol-last{padding-bottom:0 !important;}
      .btn{font-size:15px !important;padding:15px 30px !important;}
      /* Stack the header + footer so nothing bunches on a phone. */
      .head-l,.head-r,.foot-l,.foot-r{display:block !important;width:100% !important;text-align:left !important;}
      .head-r{padding-top:14px !important;}
      .foot-r{padding-top:10px !important;}
      /* Property card: photo on top, details below — no more crushed column. */
      .pcard-photo,.pcard-info{display:block !important;width:100% !important;padding-right:0 !important;}
      .pcard-photo{padding-bottom:14px !important;}
      .pcard-img{width:100% !important;max-width:100% !important;height:auto !important;}
      .px{padding-left:20px !important;padding-right:20px !important;}
      .hero-text{width:62% !important;padding:24px 6px 24px 20px !important;}
      .hero-desk{display:none !important;}
      .hero-mob{display:block !important;}
    }
  </style></head>`;
}

function emailHeaderRow(tagline: string, bottomPad = 28): string {
  return `<tr><td style="padding:4px 2px ${bottomPad}px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="head-l" align="left" valign="middle" style="white-space:nowrap;">
        <img src="${EMAIL_ASSET}/tsp-logo.png" width="42" height="42" alt="" style="vertical-align:middle;border:0;display:inline-block;">
        <span style="display:inline-block;vertical-align:middle;margin-left:10px;line-height:1;">
          <span style="display:block;font-family:${FONT_STACK};font-size:23px;font-weight:800;color:#FF6B4A;letter-spacing:-0.5px;">TSP</span>
          <span style="display:block;font-family:${FONT_STACK};font-size:9px;font-weight:700;color:#1a1d29;letter-spacing:2.5px;margin-top:3px;">SALES PROGRESSOR</span>
        </span>
      </td>
      <td class="head-r" align="right" valign="middle" style="font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:#54617d;">${tagline}</td>
    </tr></table>
  </td></tr>`;
}

function bigButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;"><tr>
    <td align="center" bgcolor="#FF6B4A" style="border-radius:18px;background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);box-shadow:0 6px 16px rgba(240,81,26,0.34);">
      <a class="btn" href="${url}" style="display:inline-block;padding:17px 46px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;border-radius:18px;white-space:nowrap;text-decoration:none;">${label}</a>
    </td></tr></table>`;
}

// Fluid-hybrid feature column: inline-blocks in a font-size:0 row sit 3-across on
// desktop and stack on phones with NO media query (works even in the Android
// Gmail app). Ghost MSO table keeps Outlook desktop in 3 columns. `divider` adds
// the faint vertical rule between columns; media query drops it when stacked.
function featureItem(iconFile: string, title: string, sub: string, divider: boolean, isLast: boolean, dividerColor = "#F3DACE"): string {
  return `<div class="fcol${isLast ? " fcol-last" : ""}" style="display:inline-block;box-sizing:border-box;width:168px;max-width:168px;vertical-align:top;text-align:center;padding:0 6px;${divider ? `border-left:1px solid ${dividerColor};` : ""}">
    <img src="${EMAIL_ASSET}/${iconFile}" width="52" height="52" alt="" style="border:0;display:block;margin:0 auto 12px;">
    <div style="font-family:${FONT_STACK};font-size:14px;font-weight:700;color:#1a1d29;line-height:1.35;">${title}</div>
    ${sub ? `<div style="font-family:${FONT_STACK};font-size:12.5px;color:#8a93a3;line-height:1.45;margin-top:5px;">${sub}</div>` : ""}
  </div>`;
}

// variant "peach" = the boxed strip (email 1); "plain" = hairline-ruled row on
// white (email 3's value props). Both stack on mobile via the .fcol rules.
function featureStrip(items: string[], variant: "peach" | "plain" = "peach"): string {
  const sep = `<!--[if mso]></td><td width="33%" valign="top"><![endif]-->`;
  const row = `<div style="text-align:center;font-size:0;"><!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="33%" valign="top"><![endif]-->${items.join(sep)}<!--[if mso]></td></tr></table><![endif]--></div>`;
  if (variant === "plain") return `<div style="border-top:1px solid #ECECEC;border-bottom:1px solid #ECECEC;padding:22px 0;">${row}</div>`;
  return `<div style="background:#FDF0EA;background:linear-gradient(180deg,#FEF4EF 0%,#FBE6DC 100%);border:1px solid #FBE1D5;border-radius:16px;padding:26px 8px;box-shadow:0 2px 12px rgba(216,90,53,0.07);">${row}</div>`;
}

// A single mini-stat in the property card: icon-left, label over value. Stays in
// a fixed 3-column table (does NOT stack on mobile), so values are kept short.
function statCell(iconFile: string, label: string, value: string, divider: boolean): string {
  return `<td width="33.33%" valign="middle" align="center" style="padding:0 4px;${divider ? "border-left:1px solid #F1DED3;" : ""}">
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;"><tr>
      <td valign="middle"><img src="${EMAIL_ASSET}/${iconFile}" width="34" height="34" alt="" style="display:block;border:0;"></td>
      <td valign="middle" style="padding-left:8px;text-align:left;">
        <div style="font-family:${FONT_STACK};font-size:10.5px;color:#9aa2b1;line-height:1.2;">${label}</div>
        <div style="font-family:${FONT_STACK};font-size:13.5px;font-weight:700;color:#1a1d29;line-height:1.25;margin-top:2px;">${value}</div>
      </td>
    </tr></table>
  </td>`;
}

function pageFooter(unsubscribeUrl?: string): string {
  const unsub = unsubscribeUrl
    ? `<td class="foot-r" align="right" valign="middle" style="font-family:${FONT_STACK};font-size:12px;color:#9aa2b1;">Don’t want these emails? <a href="${unsubscribeUrl}" style="color:#FF6B4A;text-decoration:underline;">Unsubscribe</a></td>`
    : `<td></td>`;
  return `<tr><td style="padding:24px 2px 0;">
      <div style="border-top:1px solid #ECECEC;padding-top:18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td class="foot-l" align="left" valign="middle" style="font-family:${FONT_STACK};font-size:13px;color:#FF6B4A;font-weight:800;">TSP <span style="color:#c7ccd6;font-weight:400;">&middot;</span> <span style="font-weight:500;color:#8a93a3;">Sales Progressor</span></td>
          ${unsub}
        </tr></table>
      </div>
    </td></tr>
    <tr><td style="padding-top:16px;"><img src="${EMAIL_ASSET}/footer-flourish.png" alt="" style="border:0;display:block;width:100%;max-width:100%;"></td></tr>`;
}

function emailShell(inner: string): string {
  return `<!DOCTYPE html><html lang="en">${emailHead()}<body style="margin:0;padding:0;background:#EFF0F2;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFF0F2;"><tr><td align="center" style="padding:26px 12px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;">
        <tr><td class="shell" style="padding:34px 34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${inner}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;
}

// ─── Email 1 — activation_day_1 ──────────────────────────────────────────────

export function buildActivationDay1(vars: TemplateVars): RetentionEmailResult {
  const { firstName, ctaUrl = "", unsubscribeUrl = "" } = vars;
  const subject = "Welcome to Sales Progressor";

  const heroCopy = `<p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:15px;color:#7a8493;">Hi ${firstName},</p>
    <h1 class="hl" style="margin:0;font-family:${FONT_STACK};font-size:34px;line-height:1.08;font-weight:800;color:#0F1B2D;letter-spacing:-0.8px;">Welcome to <span style="color:#FF6B4A;">Sales Progressor.</span></h1>
    <p style="margin:14px 0 0;font-family:${FONT_STACK};font-size:15.5px;font-weight:500;color:#8a93a3;line-height:1.5;">Your account is ready. Add your first sale to start using the platform.</p>`;

  // Desktop: copy overlaid on the full-bleed background image (its left ~half is empty).
  const heroDesktop = `<div class="hero-desk" style="background-color:#FDF1EA;background-image:url('${EMAIL_ASSET}/hero-welcome.png');background-repeat:no-repeat;background-size:cover;background-position:right center;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="hero-text" width="54%" valign="middle" style="padding:38px 8px 38px 34px;">${heroCopy}</td>
      <td width="46%">&nbsp;</td>
    </tr></table>
  </div>`;

  // Mobile: the Gmail app can't overlay live text on an image (no background-image
  // support), so the headline + subhead are baked into hero-welcome-mobile.png.
  // Only the greeting stays live, above it, to keep the personalised name.
  const heroMobile = `<div class="hero-mob" style="display:none;background-color:#ffffff;">
    <div style="padding:22px 22px 4px;"><p style="margin:0;font-family:${FONT_STACK};font-size:15px;color:#7a8493;">Hi ${firstName},</p></div>
    <img src="${EMAIL_ASSET}/hero-welcome-mobile.png" alt="" style="display:block;width:100%;max-width:100%;border:0;">
  </div>`;

  const body = [
    `<tr><td style="padding:24px 2px 0;font-family:${FONT_STACK};font-size:15.5px;line-height:1.6;color:#374151;">
      <p style="margin:0 0 16px;">Self-progress is free, and if you’d like us to run a sale for you, your first outsourced one is on us.</p>
      <p style="margin:0;">Either way, you’re in the right place. We’ll help you keep things moving, from offer to exchange.</p>
    </td></tr>`,
    `<tr><td style="padding:24px 0 0;">${featureStrip([
      featureItem("icon-pound.png", "Self-progress is free", "No subscription. No charge per sale.", false, false),
      featureItem("icon-team.png", "Your first outsourced sale is on us", "Let our team run it for you.", true, false),
      featureItem("icon-home.png", "Everything in one place", "Track, chase and complete with ease.", true, true),
    ])}</td></tr>`,
    `<tr><td align="center" style="padding:28px 0 0;">${bigButton("Add a sale  &rarr;", ctaUrl)}</td></tr>`,
    `<tr><td style="padding:18px 0 0;">
      <div style="background:#F3F5F7;border-radius:14px;padding:15px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle"><img src="${EMAIL_ASSET}/icon-chat.png" width="44" height="44" alt="" style="display:block;border:0;"></td>
          <td valign="middle" style="padding-left:14px;">
            <div style="font-family:${FONT_STACK};font-size:15px;font-weight:700;color:#1a1d29;">Need a hand getting set up?</div>
            <div style="font-family:${FONT_STACK};font-size:13.5px;color:#7a8493;margin-top:2px;">Just reply to this email and we’ll be happy to help.</div>
          </td>
        </tr></table>
      </div>
    </td></tr>`,
    pageFooter(unsubscribeUrl),
  ].join("");

  const html = `<!DOCTYPE html><html lang="en">${emailHead()}<body style="margin:0;padding:0;background:#EFF0F2;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFF0F2;"><tr><td align="center" style="padding:26px 12px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;">
        <tr><td class="px" style="padding:30px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${emailHeaderRow("A simpler, better way<br>to progress property sales.")}</table>
        </td></tr>
        <tr><td style="padding:0;">${heroDesktop}${heroMobile}</td></tr>
        <tr><td class="px" style="padding:6px 34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `Welcome to Sales Progressor. Your account is ready. Add your first sale to start using the platform.`,
    ``,
    `Self-progress is free, and if you’d like us to run a sale for you, your first outsourced one is on us. Either way, you’re in the right place. We’ll help you keep things moving, from offer to exchange.`,
    ``,
    `Add a sale: ${ctaUrl}`,
    ``,
    `Need a hand getting set up? Just reply to this email.`,
    ``,
    `Sales Progressor`,
  ].join("\n");

  return { subject, html, text, fromDisplayName: "Sales Progressor" };
}

// ─── Email 1b — claim_welcome ────────────────────────────────────────────────
// Sent in place of activation_day_1 when the account is created via the chain
// claim cycle (invited via a chain link, claimed their sale, signed up).
// Reuses the same welcomeEmailSentAt guard so a single user can only receive
// one welcome email of either flavour.

export function buildClaimWelcome(vars: TemplateVars): RetentionEmailResult {
  const { firstName, address = "", ctaUrl = "" } = vars;

  // Address fallback: stubPropertyAddress is nullable on ChainLink so the
  // opening sentence drops the "for {address}" clause entirely when empty,
  // never rendering a dangling "your link in the chain for  ".
  const hasAddress = address.trim().length > 0;
  const trimmedAddress = address.trim();

  const subject = `Your account is ready`;

  const openingSentence = hasAddress
    ? `You've claimed your link in the chain for ${trimmedAddress}.`
    : `You've claimed your link in the chain.`;

  const text = [
    `Hi ${firstName},`,
    ``,
    openingSentence,
    ``,
    `Open the file and you'll see your sale moving alongside the connected sales: where each is up to, what's holding things up, when exchange is likely.`,
    ``,
    `Open your sale: ${ctaUrl}`,
    ``,
    `This sale is free because it came in through the chain. Every sale you progress yourself is free. If you'd like us to run one for you, your first outsourced sale is on us.`,
    ``,
    `The account is yours to keep. Run every sale you handle the same way: each step tracked, clients in the loop without you chasing or being chased.`,
    ``,
    `Reply if you'd like a hand getting started.`,
    ``,
    `Sales Progressor`,
  ].join("\n");

  const bodyHtml = [
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${firstName},</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">${openingSentence}</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Open the file and you'll see your sale moving alongside the connected sales: where each is up to, what's holding things up, when exchange is likely.</p>`,
    ctaUrl ? ctaButton("Open your sale →", ctaUrl) : "",
    `<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6">This sale is free because it came in through the chain. Every sale you progress yourself is free. If you'd like us to run one for you, your first outsourced sale is on us.</p>`,
    `<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6">The account is yours to keep. Run every sale you handle the same way: each step tracked, clients in the loop without you chasing or being chased.</p>`,
    `<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6">Reply if you'd like a hand getting started.</p>`,
    `<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6">Sales Progressor</p>`,
  ].join("");

  return {
    subject,
    html: buildHtmlWrapper(bodyHtml),
    text,
    fromDisplayName: "Sales Progressor",
  };
}

// ─── Email 2 — stuck_day_3 ───────────────────────────────────────────────────

export function buildStuckDay3(vars: TemplateVars): RetentionEmailResult {
  const { firstName, ctaUrl = "", unsubscribeUrl = "" } = vars;
  const p = vars.property;
  const line = p?.addressLine || vars.address || "Your sale";
  const subject = `${line} is waiting for you`;

  const card = `<div style="background:#FBEDE7;background:linear-gradient(180deg,#FDF0EA 0%,#F8DFD3 100%);border:1px solid #F7D9CB;border-radius:18px;padding:16px;box-shadow:0 2px 12px rgba(216,90,53,0.07);">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="pcard-photo" width="188" valign="top" style="padding-right:16px;">
        <img class="pcard-img" src="${p?.photoUrl ?? ""}" alt="" width="188" style="display:block;border:0;width:188px;max-width:188px;height:auto;border-radius:12px;">
      </td>
      <td class="pcard-info" valign="top">
        <div style="font-family:${FONT_STACK};font-size:20px;font-weight:800;color:#1a1d29;line-height:1.2;">${p?.addressLine ?? line}</div>
        ${p?.town ? `<div style="font-family:${FONT_STACK};font-size:15px;color:#5b6577;margin-top:3px;">${p.town}</div>` : ""}
        ${p?.postcode ? `<div style="font-family:${FONT_STACK};font-size:13px;color:#9aa2b1;margin-top:1px;">${p.postcode}</div>` : ""}
        <div style="border-top:1px solid #F1DED3;margin:13px 0;font-size:0;line-height:0;">&nbsp;</div>
        <span style="display:inline-block;background:#FCDFD3;background:linear-gradient(180deg,#FEEAE1 0%,#FBD6C7 100%);border:1px solid #F7CBB9;border-radius:20px;padding:4px 14px;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:#E8562C;box-shadow:0 1px 2px rgba(216,90,53,0.16);"><span style="color:#FF6B4A;">&#9679;</span>&nbsp; Waiting for you</span>
      </td>
    </tr></table>
    <div style="margin-top:16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;width:100%;"><tr>
        ${statCell("icon-sale.png", p?.saleLabel ?? "Sale", p?.saleValue ?? "—", false)}
        ${statCell("icon-tenure.png", "Tenure", p?.tenure ?? "—", true)}
        ${statCell("icon-added.png", "Added", p?.added ?? "—", true)}
      </tr></table>
    </div>
  </div>`;

  const inner = [
    emailHeaderRow("A simpler, better way<br>to progress property sales."),
    `<tr><td style="padding:6px 2px 0;">
      <p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:16px;color:#8a93a3;">Hi ${firstName},</p>
      <h1 class="hl" style="margin:0;font-family:${FONT_STACK};font-size:32px;line-height:1.08;font-weight:800;color:#0F1B2D;letter-spacing:-0.8px;">${line} is waiting for you</h1>
      <p style="margin:14px 0 0;font-family:${FONT_STACK};font-size:15.5px;font-weight:500;color:#8a93a3;line-height:1.5;">You’ve added this sale to Sales Progressor but haven’t confirmed any milestones yet. Tick off the first few steps so we know where the sale is up to.</p>
    </td></tr>`,
    `<tr><td style="padding:26px 0 0;">${card}</td></tr>`,
    `<tr><td style="padding:24px 0 0;">
      <div style="background:#FF6B4A;background:linear-gradient(180deg,#FF7E57 0%,#F0511A 100%);border-radius:16px;text-align:center;box-shadow:0 6px 16px rgba(240,81,26,0.34);">
        <a href="${ctaUrl}" style="display:block;padding:17px 20px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Open the file  &rarr;</a>
      </div>
    </td></tr>`,
    `<tr><td style="padding:16px 0 0;">
      <div style="background:#F3F5F7;border-radius:14px;padding:15px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle"><img src="${EMAIL_ASSET}/icon-chat.png" width="44" height="44" alt="" style="display:block;border:0;"></td>
          <td valign="middle" style="padding-left:14px;">
            <div style="font-family:${FONT_STACK};font-size:15px;font-weight:700;color:#1a1d29;">Need a hand getting started?</div>
            <div style="font-family:${FONT_STACK};font-size:13.5px;color:#7a8493;margin-top:2px;">Just reply to this email and we’ll be happy to help.</div>
          </td>
        </tr></table>
      </div>
    </td></tr>`,
    // Two value props, centred as a pair, side by side even on mobile.
    `<tr><td style="padding:22px 0 0;">
      <div style="border-top:1px solid #ECECEC;border-bottom:1px solid #ECECEC;padding:20px 0;text-align:center;">
        <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
          <td valign="top" align="center" style="padding:0 20px;">
            <img src="${EMAIL_ASSET}/icon-eye.png" width="48" height="48" alt="" style="border:0;display:block;margin:0 auto 10px;">
            <div style="font-family:${FONT_STACK};font-size:14px;font-weight:700;color:#1a1d29;">More visibility</div>
            <div style="font-family:${FONT_STACK};font-size:12.5px;color:#8a93a3;margin-top:4px;">Know what’s next</div>
          </td>
          <td valign="top" align="center" style="padding:0 20px;border-left:1px solid #ECECEC;">
            <img src="${EMAIL_ASSET}/icon-people.png" width="48" height="48" alt="" style="border:0;display:block;margin:0 auto 10px;">
            <div style="font-family:${FONT_STACK};font-size:14px;font-weight:700;color:#1a1d29;">Faster sales</div>
            <div style="font-family:${FONT_STACK};font-size:12.5px;color:#8a93a3;margin-top:4px;">Work together, smoothly</div>
          </td>
        </tr></table>
      </div>
    </td></tr>`,
    pageFooter(unsubscribeUrl),
  ].join("");

  const text = [
    `Hi ${firstName},`,
    ``,
    `${line} is waiting for you.`,
    ``,
    `You’ve added this sale to Sales Progressor but haven’t confirmed any milestones yet. Tick off the first few steps so we know where the sale is up to.`,
    ``,
    `Open the file: ${ctaUrl}`,
    ``,
    `Need a hand getting started? Just reply to this email.`,
    ``,
    `Sales Progressor`,
  ].join("\n");

  return { subject, html: emailShell(inner), text, fromDisplayName: "Sales Progressor" };
}

// ─── Email 3 — first_exchange ─────────────────────────────────────────────────

export function buildFirstExchange(vars: TemplateVars): RetentionEmailResult {
  const { firstName, address = "", ctaUrl = "" } = vars;

  const subject = `Exchange confirmed on ${address}`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `Contracts have exchanged on ${address}, your first sale through Sales Progressor.`,
    ``,
    `Nothing to pay for this one.`,
    ``,
    `View the file: ${ctaUrl}`,
    ``,
    `Sales Progressor`,
  ].join("\n");

  const bodyHtml = [
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${firstName},</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Contracts have exchanged on ${address}, your first sale through Sales Progressor.</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Nothing to pay for this one.</p>`,
    ctaUrl ? ctaButton("View the file →", ctaUrl) : "",
    `<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6">Sales Progressor</p>`,
  ].join("");

  return {
    subject,
    html: buildHtmlWrapper(bodyHtml),
    text,
    fromDisplayName: "Sales Progressor",
  };
}

// ─── Email 4 — quiet_30d ──────────────────────────────────────────────────────

export function buildQuiet30d(vars: TemplateVars): RetentionEmailResult {
  const { firstName, ctaUrl = "", unsubscribeUrl = "" } = vars;

  const subject = "Your account is still active";

  const body = [
    `<tr><td style="padding:16px 2px 0;">
      <p style="margin:0 0 12px;font-family:${FONT_STACK};font-size:15px;color:#8a93a3;">Hi ${firstName},</p>
      <h1 class="hl" style="margin:0;font-family:${FONT_STACK};font-size:32px;line-height:1.1;font-weight:800;color:#0F1B2D;letter-spacing:-0.8px;">Ready when the <span style="color:#FF6B4A;">next one is.</span></h1>
      <p style="margin:15px 0 0;font-family:${FONT_STACK};font-size:15.5px;font-weight:500;color:#8a93a3;line-height:1.55;">It’s been a little while since you last added a sale to Sales Progressor. Everything you’ve already set up is still here, ready for the next one.</p>
    </td></tr>`,
    `<tr><td style="padding:26px 0 0;">${featureStrip([
      featureItem("icon-folder.png", "Your account stays open", "", false, false),
      featureItem("icon-clock.png", "Your files &amp; history stay put", "", true, false),
      featureItem("icon-pound.png", "TSP is free to use", "", true, true),
    ])}</td></tr>`,
    `<tr><td align="center" style="padding:30px 0 0;">${bigButton("Add your next sale  &rarr;", ctaUrl)}</td></tr>`,
    `<tr><td align="center" style="padding:16px 0 0;"><p style="margin:0;font-family:${FONT_STACK};font-size:14px;color:#9aa2b1;">Nothing to restart. Just pick up where you left off.</p></td></tr>`,
    pageFooter(unsubscribeUrl),
  ].join("");

  // Bespoke shell: padded header, FULL-BLEED hero (touches the card's L/R edges),
  // padded body. overflow:hidden keeps the hero inside the rounded card.
  const html = `<!DOCTYPE html><html lang="en">${emailHead()}<body style="margin:0;padding:0;background:#EFF0F2;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFF0F2;"><tr><td align="center" style="padding:26px 12px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;">
        <tr><td class="px" style="padding:30px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${emailHeaderRow("A simpler, better way<br>to progress property sales.")}</table>
        </td></tr>
        <tr><td style="padding:0;"><img src="${EMAIL_ASSET}/hero-quiet.png" alt="" style="display:block;width:100%;max-width:100%;border:0;"></td></tr>
        <tr><td class="px" style="padding:8px 34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `Ready when the next one is.`,
    ``,
    `It’s been a little while since you last added a sale to Sales Progressor. Everything you’ve already set up is still here, ready for the next one.`,
    ``,
    `Add your next sale: ${ctaUrl}`,
    ``,
    `Sales Progressor`,
    ``,
    unsubscribeUrl ? unsubscribeFooterText(unsubscribeUrl) : "",
  ].join("\n");

  return { subject, html, text, fromDisplayName: "Sales Progressor" };
}

// ─── Email 5 — send_to_us_drop_21d ───────────────────────────────────────────
// Sender: "Ellis, Sales Progressor" | No CTA button

export function buildSendToUsDrop21d(vars: TemplateVars): RetentionEmailResult {
  const { firstName, unsubscribeUrl = "" } = vars;

  const subject = "How are things going?";

  // Body + "Best regards," share one style — plain, no weight changes.
  const bodyStyle = `margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:#2b3441;`;

  const sigRow = (icon: string, inner: string) =>
    `<tr><td valign="middle" style="padding:3px 0;"><img src="${EMAIL_ASSET}/${icon}" width="17" height="17" alt="" style="display:block;border:0;"></td>
      <td valign="middle" style="padding:3px 0 3px 9px;">${inner}</td></tr>`;

  const signature = `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td>
    <div style="font-family:${FONT_STACK};font-size:15px;font-weight:700;color:#1a1d29;">Ellis Askey</div>
    <div style="font-family:${FONT_STACK};font-size:13px;color:#6b7280;margin-top:3px;">Operations Director</div>
    <div style="font-family:${FONT_STACK};font-size:13px;color:#6b7280;margin-top:1px;"><span style="color:#FF6B4A;font-weight:700;">TSP</span> &middot; Sales Progressor</div>
    <div style="font-family:${FONT_STACK};font-size:12.5px;color:#9aa2b1;margin-top:1px;">Progress made simpler.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:13px;">
      ${sigRow("sig-email.png", `<a href="mailto:ellis@thesalesprogressor.co.uk" style="font-family:${FONT_STACK};font-size:13px;color:#FF6B4A;text-decoration:underline;">ellis@thesalesprogressor.co.uk</a>`)}
      ${sigRow("sig-phone.png", `<a href="tel:+447508862929" style="font-family:${FONT_STACK};font-size:13px;color:#374151;text-decoration:none;">+44 7508 862929</a>`)}
      ${sigRow("sig-linkedin.png", `<a href="https://www.linkedin.com/in/ellisaskey/" style="font-family:${FONT_STACK};font-size:13px;color:#FF6B4A;text-decoration:underline;">LinkedIn</a>`)}
    </table>
  </td></tr></table>`;

  const bodyHtml = [
    `<p style="${bodyStyle}">Hi ${firstName},</p>`,
    `<p style="${bodyStyle}">You've used our progression service before, so I wanted to get in touch. We haven't had a file from you for a few weeks.</p>`,
    `<p style="${bodyStyle}">That usually means one of three things: a quiet patch, someone made you a better offer, or we got something wrong.</p>`,
    `<p style="${bodyStyle}">If it's the last one, I'd genuinely love to know. Just reply to this email and let me know if there's anything we could be doing better.</p>`,
    `<p style="${bodyStyle}">Hopefully it's one of the first two.</p>`,
    `<p style="margin:0 0 16px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:#2b3441;">Best regards,</p>`,
    signature,
  ].join("");

  const text = [
    `Hi ${firstName},`,
    ``,
    `You've used our progression service before, so I wanted to get in touch. We haven't had a file from you for a few weeks.`,
    ``,
    `That usually means one of three things: a quiet patch, someone made you a better offer, or we got something wrong.`,
    ``,
    `If it's the last one, I'd genuinely love to know. Just reply to this email and let me know if there's anything we could be doing better.`,
    ``,
    `Hopefully it's one of the first two.`,
    ``,
    `Best regards,`,
    `Ellis Askey`,
    `Operations Director`,
    `TSP · Sales Progressor`,
    `Progress made simpler.`,
    ``,
    `ellis@thesalesprogressor.co.uk`,
    `+44 7508 862929`,
    `https://www.linkedin.com/in/ellisaskey/`,
    ``,
    unsubscribeUrl ? unsubscribeFooterText(unsubscribeUrl) : "",
  ].join("\n");

  return {
    subject,
    html: buildHtmlWrapper(bodyHtml, unsubscribeUrl ? unsubscribeFooterHtml(unsubscribeUrl) : undefined),
    text,
    fromDisplayName: "Ellis at Sales Progressor",
  };
}

// ─── Email 6 — last_touch_60d ─────────────────────────────────────────────────

export function buildLastTouch60d(vars: TemplateVars): RetentionEmailResult {
  const { firstName, ctaUrl = "", unsubscribeUrl = "" } = vars;

  const subject = "We'll leave you to it for now";

  const body = [
    `<tr><td style="padding:12px 2px 0;">
      <h1 class="hl" style="margin:0;font-family:${FONT_STACK};font-size:32px;line-height:1.1;font-weight:800;color:#0F1B2D;letter-spacing:-0.8px;">We’ll leave you to it for now.</h1>
      <p style="margin:11px 0 0;font-family:${FONT_STACK};font-size:18px;font-weight:500;color:#8a93a3;line-height:1.35;">Your account isn’t going anywhere.</p>
    </td></tr>`,
    `<tr><td style="padding:22px 2px 0;font-family:${FONT_STACK};font-size:15.5px;line-height:1.6;color:#374151;">
      <p style="margin:0 0 18px;">Hi ${firstName},</p>
      <p style="margin:0 0 18px;">It looks like you haven’t had a chance to get started, so we’re going to stop sending you reminders.</p>
      <p style="margin:0;">Nothing’s being closed or removed.<br>Your account will be here whenever you’re ready, and if you have any active sales, we’ll still keep you updated on those.</p>
    </td></tr>`,
    `<tr><td style="padding:26px 0 0;">${featureStrip([
      featureItem("icon-person.png", "Your account stays open", "Log back in anytime.", false, false),
      featureItem("icon-bell.png", "Active sale updates continue", "You’ll still receive important updates.", true, false),
      featureItem("icon-home.png", "Come back whenever you’re ready", "Pick up exactly where you left off.", true, true),
    ])}</td></tr>`,
    `<tr><td align="center" style="padding:30px 0 0;">${bigButton("Pick up where you left off  &rarr;", ctaUrl)}</td></tr>`,
    `<tr><td align="center" style="padding:16px 0 0;"><p style="margin:0;font-family:${FONT_STACK};font-size:14px;color:#9aa2b1;">No rush. Everything will be here when you’re ready.</p></td></tr>`,
    pageFooter(unsubscribeUrl),
  ].join("");

  // Full-bleed hero (matches the Welcome + Quiet emails): padded header, hero to
  // the card edges, padded body. Header bottomPad + body top kept tight so the
  // hero doesn't float in a big gap between the tagline and the headline.
  const html = `<!DOCTYPE html><html lang="en">${emailHead()}<body style="margin:0;padding:0;background:#EFF0F2;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFF0F2;"><tr><td align="center" style="padding:26px 12px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;">
        <tr><td class="px" style="padding:30px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${emailHeaderRow("A simpler, better way<br>to progress property sales.", 14)}</table>
        </td></tr>
        <tr><td style="padding:0;"><img src="${EMAIL_ASSET}/hero-pause.png" alt="" style="display:block;width:100%;max-width:100%;border:0;"></td></tr>
        <tr><td class="px" style="padding:6px 34px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `It looks like you haven't had a chance to get started, so we're going to stop sending you reminders.`,
    ``,
    `Nothing's being closed or removed. Your account will be here whenever you're ready, and if you have any active sales, we'll still keep you updated on those.`,
    ``,
    `Pick up where you left off: ${ctaUrl}`,
    ``,
    `Sales Progressor`,
    ``,
    unsubscribeUrl ? unsubscribeFooterText(unsubscribeUrl) : "",
  ].join("\n");

  return { subject, html, text, fromDisplayName: "Sales Progressor" };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export type RetentionEmailKey =
  | "activation_day_1"
  | "claim_welcome"
  | "stuck_day_3"
  | "first_exchange"
  | "quiet_30d"
  | "send_to_us_drop_21d"
  | "last_touch_60d";

export const RETENTION_EMAIL_KEYS: RetentionEmailKey[] = [
  "activation_day_1",
  "claim_welcome",
  "stuck_day_3",
  "first_exchange",
  "quiet_30d",
  "send_to_us_drop_21d",
  "last_touch_60d",
];

/** Emails that are transactional — send regardless of opt-out */
export const TRANSACTIONAL_EMAIL_KEYS: RetentionEmailKey[] = [
  "activation_day_1",
  "claim_welcome",
  "stuck_day_3",
  "first_exchange",
];

export function buildRetentionEmail(key: RetentionEmailKey, vars: TemplateVars): RetentionEmailResult {
  switch (key) {
    case "activation_day_1":    return buildActivationDay1(vars);
    case "claim_welcome":       return buildClaimWelcome(vars);
    case "stuck_day_3":         return buildStuckDay3(vars);
    case "first_exchange":      return buildFirstExchange(vars);
    case "quiet_30d":           return buildQuiet30d(vars);
    case "send_to_us_drop_21d": return buildSendToUsDrop21d(vars);
    case "last_touch_60d":      return buildLastTouch60d(vars);
  }
}
