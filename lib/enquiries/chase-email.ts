// The enquiries chase email — plain, human, and pointed at whoever holds the
// ball. Deliberately NOT the branded milestone template: it reads like a note
// a person would send from Outlook, and the solicitor can just reply (which
// lands in the sender's inbox and counts as a movement) or tap the button.
//
// Two directions, keyed on the tracker's whose-court state:
//   - seller_solicitor: they owe the replies -> "any update on the replies?"
//   - buyer_solicitor:  they're reviewing    -> "satisfied, or anything left?"
//
// Personal by design: greets the handler by first name where we have it, and
// names the OTHER side's firm rather than "the seller's/buyer's solicitor".
// Variant-agnostic otherwise: enquiries chasing is identical across
// freehold/leasehold and every funding type.

import { timeGreeting } from "@/lib/emails/greeting";

export type EnquiryChaseCourt = "seller_solicitor" | "buyer_solicitor";

export type EnquiryChaseInput = {
  court: EnquiryChaseCourt;
  address: string;
  clientNames: string[]; // the clients on the recipient's side (for the subject)
  recipientFirstName?: string; // the handler, for a "Hi <name>," greeting
  senderName: string; // the person the email is from
  agencyName: string;
  provideUpdateUrl: string;
  now?: Date;
};

// Join names for a subject line: "A", "A & B", "A, B & C".
function joinClientNames(names: string[]): string {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(", ")} & ${clean[clean.length - 1]}`;
}

// House convention for solicitor email subjects:
//   "Purchase of <address>, Client: <name>"  (buyer's solicitor)
//   "Sale of <address>, Clients: <a> & <b>"  (seller's solicitor)
export function solicitorEmailSubject(opts: {
  side: "vendor" | "purchaser";
  address: string;
  clientNames: string[];
}): string {
  const deal = opts.side === "purchaser" ? "Purchase" : "Sale";
  const names = opts.clientNames.filter(Boolean);
  if (names.length === 0) return `${deal} of ${opts.address}`;
  const label = names.length === 1 ? "Client" : "Clients";
  return `${deal} of ${opts.address}, ${label}: ${joinClientNames(names)}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// "Hi James," where we know the handler, else a time-of-day greeting.
function greetingLine(recipientFirstName: string | undefined, now: Date): string {
  const name = recipientFirstName?.trim();
  return name ? `Hi ${name},` : `${timeGreeting(now)},`;
}

const WRAP = "font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;";
const BTN = "display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;";

// Firm we name in the body: the OTHER side's firm, with a graceful fallback.
function otherFirmLabel(otherFirmName: string | undefined, side: "vendor" | "purchaser"): string {
  const clean = otherFirmName?.trim();
  if (clean) return clean;
  // side = the RECIPIENT's side; the other side is the opposite.
  return side === "purchaser" ? "the seller's solicitor" : "the buyer's solicitor";
}

// Clients named in the body: the recipient's own clients, with a fallback.
function clientsLabel(clientNames: string[], side: "vendor" | "purchaser"): string {
  const joined = joinClientNames(clientNames);
  if (joined) return joined;
  return side === "purchaser" ? "the buyer" : "the seller";
}

// ── Reply-loop chase (emails 3 & 4) ──────────────────────────────────────────
export function buildEnquiryChaseEmail(input: EnquiryChaseInput): {
  subject: string;
  text: string;
  html: string;
} {
  const { court, address, clientNames, recipientFirstName, senderName, agencyName, provideUpdateUrl } = input;
  const isSeller = court === "seller_solicitor";
  const side: "vendor" | "purchaser" = isSeller ? "vendor" : "purchaser";
  const greeting = greetingLine(recipientFirstName, input.now ?? new Date());
  const subject = solicitorEmailSubject({ side, address, clientNames });

  const opener = isSeller
    ? `I'm just chasing for an update on the outstanding enquiries for ${address}.`
    : `I'm just chasing for an update on the enquiries for ${address}.`;
  const ask = isSeller
    ? `Would you be able to let me know where things currently stand, and whether there's anything holding up the remaining responses at your end?`
    : `Would you be able to let me know whether you're now satisfied with the replies received, or if anything is still outstanding?`;
  const ifClause = isSeller
    ? `If you have an update, please can you confirm using the button below. If you're still waiting on anything before you can respond, but have an idea of when you expect to be able to do so, please let me know and we'll hold off checking in again until then.`
    : `If you're satisfied with the replies, please confirm below. If anything remains outstanding, please let me know when you expect it to be resolved and we'll hold off chasing until then.`;

  const text = [
    greeting,
    ``,
    `I hope you are well.`,
    ``,
    opener,
    ``,
    ask,
    ``,
    ifClause,
    ``,
    provideUpdateUrl,
    ``,
    `Alternatively, simply reply to this email and it will come directly to me.`,
    ``,
    `Best regards,`,
    senderName,
    agencyName,
  ].join("\n");

  const html = `<div style="${WRAP}">
<p>${esc(greeting)}</p>
<p>I hope you are well.</p>
<p>${esc(opener)}</p>
<p>${esc(ask)}</p>
<p>${esc(ifClause)}</p>
<p><a href="${esc(provideUpdateUrl)}" style="${BTN}">Provide an update</a></p>
<p>Alternatively, simply reply to this email and it will come directly to me.</p>
<p>Best regards,<br>${esc(senderName)}<br>${esc(agencyName)}</p>
</div>`;

  return { subject, text, html };
}

// ── One-time "both sides, just checking in" opener (emails 5 & 6) ─────────────
// For genuinely-unknown + overdue files at turn-on. Neutral: assumes nobody owes
// anything yet, just asks where things stand. No button — a reply is the update.
export function buildEnquiryOpenerEmail(input: {
  side: "vendor" | "purchaser"; // the recipient's side
  address: string;
  clientNames: string[]; // the recipient's own clients
  otherFirmName?: string; // the other side's firm, named in the body
  recipientFirstName?: string;
  senderName: string;
  agencyName: string;
  now?: Date;
}): { subject: string; text: string; html: string } {
  const { side, address, clientNames, otherFirmName, recipientFirstName, senderName, agencyName } = input;
  const buyer = side === "purchaser";
  const deal = buyer ? "purchase" : "sale";
  const greeting = greetingLine(recipientFirstName, input.now ?? new Date());
  const subject = solicitorEmailSubject({ side, address, clientNames });
  const clients = clientsLabel(clientNames, side);
  const otherFirm = otherFirmLabel(otherFirmName, side);

  const line1 = `I'm progressing the ${deal} of ${address} on behalf of ${clients} and just wanted to check in on where things currently stand with the legal enquiries.`;
  const line2 = `When you have a moment, would you mind letting me know if there's anything still outstanding at your end, or anything you're currently waiting on from ${otherFirm}?`;
  const line3 = `If there's anything I can help with from my side to keep things moving, please do let me know.`;

  const text = [greeting, ``, `I hope you are well.`, ``, line1, ``, line2, ``, line3, ``, `Best regards,`, senderName, agencyName].join("\n");
  const html = `<div style="${WRAP}">
<p>${esc(greeting)}</p>
<p>I hope you are well.</p>
<p>${esc(line1)}</p>
<p>${esc(line2)}</p>
<p>${esc(line3)}</p>
<p>Best regards,<br>${esc(senderName)}<br>${esc(agencyName)}</p>
</div>`;

  return { subject, text, html };
}
