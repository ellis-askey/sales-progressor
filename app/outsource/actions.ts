"use server";

// Public "hand us a file" intake for the outsourced service landing page.
// v1 is email-only: a lead lands in the internal inbox (with the agent's address
// as Reply-To so we can reply straight back), and the agent gets a confirmation.
// No DB model yet — the tracking dashboard + OutsourceLead table come next.

import { sendEmail } from "@/lib/email";

// Where new leads land. A monitored internal inbox; change in setup if needed.
const LEADS_INBOX = process.env.OUTSOURCE_LEADS_INBOX ?? "support@thesalesprogressor.co.uk";
const SP_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type OutsourceLeadInput = {
  name: string;
  agency: string;
  email: string;
  phone?: string;
  propertyAddress: string;
  notes?: string;
};

export async function submitOutsourceLead(input: OutsourceLeadInput): Promise<{ ok: boolean; error?: string }> {
  const name = (input.name ?? "").trim();
  const agency = (input.agency ?? "").trim();
  const email = (input.email ?? "").trim();
  const propertyAddress = (input.propertyAddress ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const notes = (input.notes ?? "").trim();

  if (!name || !agency || !propertyAddress) {
    return { ok: false, error: "Please fill in your name, agency and the property address." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "That email address doesn't look right." };
  }

  const lines = [
    `Name: ${name}`,
    `Agency: ${agency}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    `Property: ${propertyAddress}`,
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean);

  try {
    // Internal notification — reply-to the agent so a reply goes straight to them.
    await sendEmail({
      to: LEADS_INBOX,
      subject: `New sale to progress: ${agency}`,
      text: `A new sale has been handed over via the outsource page.\n\n${lines.join("\n")}\n`,
      from: SP_FROM,
      replyTo: email,
      emailType: "OUTSOURCE_LEAD",
    });
  } catch (err) {
    console.error("[outsource-lead] internal notification failed:", err);
    return { ok: false, error: "Something went wrong sending that over. Try again, or email support@thesalesprogressor.co.uk." };
  }

  // Confirmation to the agent — best-effort, never blocks the lead.
  const firstName = name.split(/\s+/)[0] || name;
  await sendEmail({
    to: email,
    subject: "We've got your sale",
    text: `Hi ${firstName},\n\nThanks for handing us ${propertyAddress}. We've received the details and we'll be in touch shortly to get started.\n\nThere's nothing to pay unless it exchanges.\n\nSales Progressor\nsupport@thesalesprogressor.co.uk\n`,
    from: SP_FROM,
    replyTo: "support@thesalesprogressor.co.uk",
    emailType: "OUTSOURCE_LEAD_CONFIRM",
  }).catch((err) => console.error("[outsource-lead] agent confirmation failed:", err));

  return { ok: true };
}
