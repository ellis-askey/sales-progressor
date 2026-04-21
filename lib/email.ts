import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  text,
  from,
}: {
  to: string;
  subject: string;
  text: string;
  from?: string;
}) {
  return resend.emails.send({
    from: from ?? "Sales Progressor <notifications@thesalesprogressor.co.uk>",
    to,
    subject,
    text,
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
