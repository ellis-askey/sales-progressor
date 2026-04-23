import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const DEFAULT_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";

export async function sendEmail({
  to,
  subject,
  text,
  html,
  from,
  replyTo,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  replyTo?: string;
}) {
  return sgMail.send({
    to,
    from: from ?? DEFAULT_FROM,
    replyTo: replyTo,
    subject,
    text,
    html: html ?? text.replace(/\n/g, "<br>"),
  });
}

export function parseEmailMessage(raw: string): { subject: string; body: string } {
  const lines = raw.trim().split("\n");
  const subjectLine = lines.find((l) => l.toLowerCase().startsWith("subject:"));
  if (subjectLine) {
    const subject = subjectLine.replace(/^subject:\s*/i, "").trim();
    const bodyStart = lines.indexOf(subjectLine) + 1;
    const body = lines.slice(bodyStart).join("\n").trimStart();
    return { subject, body };
  }
  return { subject: "Chase: property transaction update", body: raw };
}
