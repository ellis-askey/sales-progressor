import "server-only";
import { sendEmail } from "@/lib/email";
import { buildFrom } from "@/lib/email/from-name";
import type { FormDefinition, ResponseAnswers } from "./types";
import { formatAnswerForDisplay } from "./csv";

// Submission notifications for Boardwalk Forms. Sent from the shared verified
// SendGrid address but with the tenant's own display name and a neutral,
// tenant-branded shell — nothing here reads as a TSP sales-progression email.
// A per-tenant verified sender (like Agency.quoteSenderEmail) is a later step.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(opts: {
  tenantName: string;
  accent: string;
  heading: string;
  bodyHtml: string;
  footer: string;
}): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f3f0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f0;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
<tr><td style="height:5px;background:${opts.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 36px 8px;font-family:Arial,Helvetica,sans-serif;">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8a8680;">${escapeHtml(opts.tenantName)}</p>
  <h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#1c1a17;">${escapeHtml(opts.heading)}</h1>
</td></tr>
<tr><td style="padding:0 36px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#3d3a35;">
${opts.bodyHtml}
</td></tr>
</table>
<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9b968e;">${escapeHtml(opts.footer)}</p>
</td></tr>
</table>
</body></html>`;
}

/** Notifies the configured internal recipients that a response arrived. */
export async function sendSubmissionNotification(opts: {
  tenantName: string;
  formTitle: string;
  formId: string;
  def: FormDefinition;
  answers: ResponseAnswers;
  baseUrl: string;
}): Promise<void> {
  const recipients = opts.def.settings.notifyEmails;
  if (!recipients.length) return;

  const rows = opts.def.questions
    .filter((q) => q.type !== "statement" && opts.answers[q.id] !== undefined)
    .map((q) => {
      const value = formatAnswerForDisplay(q, opts.answers[q.id]);
      return `<tr>
<td style="padding:8px 0;border-bottom:1px solid #eeece8;font-size:12px;color:#8a8680;vertical-align:top;width:45%;">${escapeHtml(q.title || "Untitled question")}</td>
<td style="padding:8px 0 8px 12px;border-bottom:1px solid #eeece8;font-size:13px;color:#1c1a17;vertical-align:top;">${escapeHtml(value || "–")}</td>
</tr>`;
    })
    .join("");

  const responsesUrl = `${opts.baseUrl}/boardwalk/forms/${opts.formId}/responses`;
  const bodyHtml = `
<p style="margin:0 0 16px;">You've received a new response to <strong>${escapeHtml(opts.formTitle)}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="margin:22px 0 0;">
<a href="${responsesUrl}" style="display:inline-block;background:${opts.def.theme.primaryColor};color:${opts.def.theme.buttonTextColor};text-decoration:none;font-size:14px;padding:11px 22px;border-radius:${opts.def.theme.buttonRadius}px;">View all responses</a>
</p>`;

  const text = `You've received a new response to "${opts.formTitle}".\n\n${opts.def.questions
    .filter((q) => q.type !== "statement" && opts.answers[q.id] !== undefined)
    .map((q) => `${q.title}: ${formatAnswerForDisplay(q, opts.answers[q.id])}`)
    .join("\n")}\n\nView all responses: ${responsesUrl}`;

  await sendEmail({
    to: recipients,
    subject: `New response: ${opts.formTitle}`,
    text,
    html: shell({
      tenantName: `${opts.tenantName} Forms`,
      accent: opts.def.theme.primaryColor,
      heading: "New form response",
      bodyHtml,
      footer: `Sent by ${opts.tenantName} Forms because this address is set to receive submission alerts.`,
    }),
    from: buildFrom(`${opts.tenantName} Forms`),
    emailType: "forms_submission_notification",
  });
}

/** Confirmation to the respondent, sent to their first email-type answer. */
export async function sendRespondentConfirmation(opts: {
  tenantName: string;
  formTitle: string;
  def: FormDefinition;
  answers: ResponseAnswers;
}): Promise<void> {
  const conf = opts.def.settings.respondentConfirmation;
  if (!conf.enabled) return;
  const emailQuestion = opts.def.questions.find(
    (q) => q.type === "email" && typeof opts.answers[q.id] === "string" && opts.answers[q.id]
  );
  if (!emailQuestion) return;
  const to = String(opts.answers[emailQuestion.id]);

  const message =
    conf.message || `Thanks for completing ${opts.formTitle}. We've received your answers and we'll be in touch if anything needs following up.`;

  await sendEmail({
    to,
    subject: conf.subject || `Thanks, we've received your answers`,
    text: `${message}\n\n${opts.tenantName}`,
    html: shell({
      tenantName: opts.tenantName,
      accent: opts.def.theme.primaryColor,
      heading: conf.subject || "Thanks, we've received your answers",
      bodyHtml: `<p style="margin:0;">${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`,
      footer: `You're receiving this because you completed "${opts.formTitle}".`,
    }),
    from: buildFrom(opts.tenantName),
    emailType: "forms_respondent_confirmation",
  });
}

/** Password-reset link for a Boardwalk Forms account. */
export async function sendFormsPasswordReset(opts: {
  tenantName: string;
  tenantSlug: string;
  to: string;
  name: string;
  token: string;
  baseUrl: string;
}): Promise<void> {
  const url = `${opts.baseUrl}/${opts.tenantSlug}/reset?token=${opts.token}`;
  await sendEmail({
    to: opts.to,
    subject: `Reset your ${opts.tenantName} Forms password`,
    text: `Hi ${opts.name},\n\nUse this link to choose a new password (valid for 1 hour):\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
    html: shell({
      tenantName: `${opts.tenantName} Forms`,
      accent: "#404648",
      heading: "Reset your password",
      bodyHtml: `
<p style="margin:0 0 16px;">Hi ${escapeHtml(opts.name)},</p>
<p style="margin:0 0 16px;">Use the button below to choose a new password. The link is valid for 1 hour.</p>
<p style="margin:0 0 16px;"><a href="${url}" style="display:inline-block;background:#404648;color:#ffffff;text-decoration:none;font-size:14px;padding:11px 22px;border-radius:10px;">Choose a new password</a></p>
<p style="margin:0;color:#8a8680;font-size:12px;">If you didn't ask for this, you can ignore this email. Nothing changes until the link is used.</p>`,
      footer: `Sent by ${opts.tenantName} Forms.`,
    }),
    from: buildFrom(`${opts.tenantName} Forms`),
    emailType: "forms_password_reset",
  });
}
