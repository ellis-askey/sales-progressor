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

type TemplateVars = {
  firstName: string;
  address?: string;
  ctaUrl?: string;
  unsubscribeUrl?: string;
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

// ─── Email 1 — activation_day_1 ──────────────────────────────────────────────

export function buildActivationDay1(vars: TemplateVars): RetentionEmailResult {
  const { firstName, ctaUrl = "" } = vars;

  const subject = "Welcome to Sales Progressor";

  const text = [
    `Hi ${firstName},`,
    ``,
    `Your account is ready. Add your first sale to start using the platform — you only pay when it exchanges.`,
    ``,
    `Add a sale: ${ctaUrl}`,
    ``,
    `Reply to this email if you need a hand getting set up.`,
    ``,
    `— The Sales Progressor team`,
  ].join("\n");

  const bodyHtml = [
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${firstName},</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Your account is ready. Add your first sale to start using the platform — you only pay when it exchanges.</p>`,
    ctaUrl ? ctaButton("Add a sale →", ctaUrl) : "",
    `<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6">Reply to this email if you need a hand getting set up.</p>`,
    `<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6">— The Sales Progressor team</p>`,
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
  const { firstName, address = "", ctaUrl = "" } = vars;

  const subject = `Your sale at ${address} is waiting on you`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `You've added ${address} to Sales Progressor but haven't confirmed any milestones yet. The system starts working once the first few steps are ticked off.`,
    ``,
    `Open the file: ${ctaUrl}`,
    ``,
    `Reply to this email if you'd like a hand getting going.`,
    ``,
    `— The Sales Progressor team`,
  ].join("\n");

  const bodyHtml = [
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${firstName},</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">You've added ${address} to Sales Progressor but haven't confirmed any milestones yet. The system starts working once the first few steps are ticked off.</p>`,
    ctaUrl ? ctaButton("Open the file →", ctaUrl) : "",
    `<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6">Reply to this email if you'd like a hand getting going.</p>`,
    `<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6">— The Sales Progressor team</p>`,
  ].join("");

  return {
    subject,
    html: buildHtmlWrapper(bodyHtml),
    text,
    fromDisplayName: "Sales Progressor",
  };
}

// ─── Email 3 — first_exchange ─────────────────────────────────────────────────

export function buildFirstExchange(vars: TemplateVars): RetentionEmailResult {
  const { firstName, address = "", ctaUrl = "" } = vars;

  const subject = `Exchange confirmed on ${address}`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `Contracts have exchanged on ${address} — your first sale through Sales Progressor.`,
    ``,
    `An invoice for £59 will follow shortly.`,
    ``,
    `View the file: ${ctaUrl}`,
    ``,
    `— The Sales Progressor team`,
  ].join("\n");

  const bodyHtml = [
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${firstName},</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Contracts have exchanged on ${address} — your first sale through Sales Progressor.</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">An invoice for £59 will follow shortly.</p>`,
    ctaUrl ? ctaButton("View the file →", ctaUrl) : "",
    `<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6">— The Sales Progressor team</p>`,
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

  const text = [
    `Hi ${firstName},`,
    ``,
    `It's been a month since you last added a sale to Sales Progressor. Your account, files, and history are all still in place whenever you're ready.`,
    ``,
    `Add a sale: ${ctaUrl}`,
    ``,
    `— The Sales Progressor team`,
    ``,
    unsubscribeUrl ? unsubscribeFooterText(unsubscribeUrl) : "",
  ].join("\n");

  const bodyHtml = [
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${firstName},</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">It's been a month since you last added a sale to Sales Progressor. Your account, files, and history are all still in place whenever you're ready.</p>`,
    ctaUrl ? ctaButton("Add a sale →", ctaUrl) : "",
    `<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6">— The Sales Progressor team</p>`,
  ].join("");

  return {
    subject,
    html: buildHtmlWrapper(bodyHtml, unsubscribeUrl ? unsubscribeFooterHtml(unsubscribeUrl) : undefined),
    text,
    fromDisplayName: "Sales Progressor",
  };
}

// ─── Email 5 — send_to_us_drop_21d ───────────────────────────────────────────
// Sender: "Ellis — Sales Progressor" | No CTA button

export function buildSendToUsDrop21d(vars: TemplateVars): RetentionEmailResult {
  const { firstName, unsubscribeUrl = "" } = vars;

  const subject = "How are things your end?";

  const text = [
    `Hi ${firstName},`,
    ``,
    `You've used our progression service before, so I wanted to drop you a line — we haven't had a file from you for a few weeks.`,
    ``,
    `That usually means one of three things: a quiet patch, someone made you a better offer, or we got something wrong.`,
    ``,
    `If it's the last one, I'd love to hear from you to see if there's any way we can improve our service. I'm available noon or night, hope to hear from you soon.`,
    ``,
    `Ellis`,
    `Sales Progressor`,
    ``,
    unsubscribeUrl ? unsubscribeFooterText(unsubscribeUrl) : "",
  ].join("\n");

  const bodyHtml = [
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${firstName},</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">You've used our progression service before, so I wanted to drop you a line — we haven't had a file from you for a few weeks.</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">That usually means one of three things: a quiet patch, someone made you a better offer, or we got something wrong.</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">If it's the last one, I'd love to hear from you to see if there's any way we can improve our service. I'm available noon or night, hope to hear from you soon.</p>`,
    `<p style="margin:0 0 4px;color:#374151;font-size:15px;line-height:1.6">Ellis</p>`,
    `<p style="margin:0;color:#374151;font-size:15px;line-height:1.6">Sales Progressor</p>`,
  ].join("");

  return {
    subject,
    html: buildHtmlWrapper(bodyHtml, unsubscribeUrl ? unsubscribeFooterHtml(unsubscribeUrl) : undefined),
    text,
    fromDisplayName: "Ellis — Sales Progressor",
  };
}

// ─── Email 6 — last_touch_60d ─────────────────────────────────────────────────

export function buildLastTouch60d(vars: TemplateVars): RetentionEmailResult {
  const { firstName, ctaUrl = "", unsubscribeUrl = "" } = vars;

  const subject = "Pausing email updates";

  const text = [
    `Hi ${firstName},`,
    ``,
    `We're pausing the activation emails on your account.`,
    ``,
    `You'll still get updates on any active files, and your account stays open. Add a sale or log back in any time to pick up where you left off.`,
    ``,
    `Log in: ${ctaUrl}`,
    ``,
    `— The Sales Progressor team`,
    ``,
    unsubscribeUrl ? unsubscribeFooterText(unsubscribeUrl) : "",
  ].join("\n");

  const bodyHtml = [
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Hi ${firstName},</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">We're pausing the activation emails on your account.</p>`,
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">You'll still get updates on any active files, and your account stays open. Add a sale or log back in any time to pick up where you left off.</p>`,
    ctaUrl ? ctaButton("Log in →", ctaUrl) : "",
    `<p style="margin:16px 0 0;color:#374151;font-size:15px;line-height:1.6">— The Sales Progressor team</p>`,
  ].join("");

  return {
    subject,
    html: buildHtmlWrapper(bodyHtml, unsubscribeUrl ? unsubscribeFooterHtml(unsubscribeUrl) : undefined),
    text,
    fromDisplayName: "Sales Progressor",
  };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export type RetentionEmailKey =
  | "activation_day_1"
  | "stuck_day_3"
  | "first_exchange"
  | "quiet_30d"
  | "send_to_us_drop_21d"
  | "last_touch_60d";

export const RETENTION_EMAIL_KEYS: RetentionEmailKey[] = [
  "activation_day_1",
  "stuck_day_3",
  "first_exchange",
  "quiet_30d",
  "send_to_us_drop_21d",
  "last_touch_60d",
];

/** Emails that are transactional — send regardless of opt-out */
export const TRANSACTIONAL_EMAIL_KEYS: RetentionEmailKey[] = [
  "activation_day_1",
  "stuck_day_3",
  "first_exchange",
];

export function buildRetentionEmail(key: RetentionEmailKey, vars: TemplateVars): RetentionEmailResult {
  switch (key) {
    case "activation_day_1":    return buildActivationDay1(vars);
    case "stuck_day_3":         return buildStuckDay3(vars);
    case "first_exchange":      return buildFirstExchange(vars);
    case "quiet_30d":           return buildQuiet30d(vars);
    case "send_to_us_drop_21d": return buildSendToUsDrop21d(vars);
    case "last_touch_60d":      return buildLastTouch60d(vars);
  }
}
