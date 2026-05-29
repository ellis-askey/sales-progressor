// Milestone confirmation batching + digest assembly.
//
// When the agent ticks off multiple milestones in a short window, the
// vendor and purchaser contacts should receive one batched email rather
// than a barrage. This module handles the digest assembly half of that
// flow; the enqueue half lives in sendRichMilestoneEmails
// (lib/services/portal.ts), and the cron drain wiring lives in
// app/api/cron/send-milestone-digests/route.ts.
//
// N=1 case: drain sends the queued payload (subject/text/html) verbatim —
// the same locked single-event copy the FINAL email matrix produces. No
// "digest of one" routing; the single-event template is the source of
// truth in that case.
//
// N>=2 case: drain calls assembleMilestoneDigest, which produces a single
// "Updates on {address}" email with up to two sections — "What you've
// confirmed today:" (acted-side items) and "What's happened on the
// {seller's|buyer's} side:" (counterpart items). Items are sorted by
// JOURNEY_ORDER (natural transaction sequence), NOT by confirmation
// timestamp.
//
// PR 2 bilateral suppression runs at enqueue time in sendRichMilestoneEmails
// (the suppressed side never gets a queue row), so the digest assembler
// here doesn't need to re-evaluate suppression. If a row reached the
// queue, its recipient is entitled to that item.

import { JOURNEY_ORDER } from "@/lib/email-skeletons/journey-order";

// ─── Digest payload shape ────────────────────────────────────────────────
//
// What sendRichMilestoneEmails stores in OutboundEmailQueue.payload at
// enqueue time. The first four fields are the rendered single-event
// email (used as-is on N=1 drain). The rest is the metadata the digest
// assembler needs on N>=2 drain.

export type MilestoneDigestPayload = {
  // Single-event send body — pre-rendered at enqueue time so the drain
  // path doesn't need to re-resolve copy. On N=1 the drain sends these
  // verbatim — that's the "do not break PR 1" contract.
  subject: string;
  text: string;
  html: string;

  // Per-recipient digest assembly metadata.
  milestoneCode: string;                       // e.g. "VM7" / "PM14"
  recipientSide: "vendor" | "purchaser";       // which side this row is for
  address: string;                             // property address
  firstName: string;                           // recipient's first name
  portalUrl: string;                           // per-recipient portal link
};

// ─── Side helpers ────────────────────────────────────────────────────────

// V* codes are acted on by the vendor side; P* codes by the purchaser
// side. (This is the same prefix-based derivation PR 2's suppression
// helper uses — see computeBilateralSuppressedRecipient.)
export function actedSideForCode(code: string): "vendor" | "purchaser" {
  return code.startsWith("V") ? "vendor" : "purchaser";
}

// For a given recipient on a given milestone, is the item acted-side
// (the recipient themselves acted) or counterpart-side (the other side
// acted, the recipient is being informed)?
function classifyForRecipient(
  milestoneCode: string,
  recipientSide: "vendor" | "purchaser",
): "acted" | "counterpart" {
  return actedSideForCode(milestoneCode) === recipientSide ? "acted" : "counterpart";
}

// ─── Digest-line lookup ─────────────────────────────────────────────────
//
// Per-milestone, per-side one-sentence summaries. Index 0 = acted-side
// view (active voice, recipient's own action). Index 1 = counterpart
// view (third-person, recipient hearing about the other side's action).
//
// Voice: same locked rules as the FINAL email matrix. Active present
// where natural, commas (not em dashes), no filler. Each line reads as
// a complete sentence so the bulleted list in the digest is parseable
// without re-reading.
//
// Codes that fire vendor-only (VM9, VM17, VM19, VM20) only need the
// acted-side line; the counterpart string is empty and the classifier
// guarantees no counterpart-side delivery exists for these codes anyway.
// Same for purchaser-only codes (PM2, PM10, PM16, PM19, PM26, PM27).

const DIGEST_LINES: Record<string, readonly [string, string]> = {
  // Phase 1 — Instruction
  VM1: ["You've instructed your solicitor.", "The seller's solicitor is instructed."],
  PM1: ["You've instructed your solicitor.", "The buyer's solicitor is instructed."],

  // Phase 2 — Memorandum of sale
  VM2: ["The memorandum of sale has gone out.", "The memorandum of sale has been issued."],
  PM2: ["The memorandum of sale has reached your solicitor.", ""],

  // Phase 3 — Welcome pack, ID/AML, money on account
  VM3: ["Your solicitor's welcome pack has landed.", "The seller has their welcome pack from their solicitor."],
  VM4: ["Your ID and AML checks are done.", "The seller's ID and AML checks are done."],
  PM3: ["Your ID and AML checks are done.", "The buyer's ID and AML checks are done."],
  PM4: ["Your payment on account is with your solicitor.", "The buyer's funds are with their solicitor."],

  // Phase 4 — Property information forms
  VM5: ["Your property information forms have arrived.", "The seller has their property information forms."],
  VM6: ["Your completed property forms are back with your solicitor.", "The seller has returned their property forms."],

  // Phase 5 — Mortgage
  PM5: ["Your mortgage application is with the lender.", "The buyer's mortgage application has gone in."],
  PM6: ["Your lender's valuation is scheduled.", "The buyer's lender valuation is booked."],
  PM11: ["Your mortgage offer is with your solicitor.", "The buyer's mortgage offer has landed."],

  // Phase 6 — Draft contract pack
  VM7: ["Your solicitor's sent the contract pack across to the buyer's side.", "The seller's solicitor has issued the contract pack."],
  PM7: ["Your solicitor has the contract pack from the seller's side.", "The buyer's solicitor has received the contract pack."],

  // Phase 7 — Management pack (leasehold only)
  VM8: ["Your solicitor has requested the management pack from your freeholder.", "The seller's solicitor has requested the management pack."],
  VM9: ["The management pack is back with your solicitor.", ""],
  PM12: ["Your solicitor has the management pack.", "The buyer's solicitor has the management pack."],

  // Phase 8 — Searches
  PM8: ["Your solicitor has ordered the searches.", "The buyer's solicitor has ordered searches."],
  PM13: ["Your search results are with your solicitor.", "The buyer's search results are in."],

  // Phase 9 — Survey
  PM9: ["Your survey is booked.", "The buyer has booked their survey."],
  PM10: ["Your survey report has landed.", ""],

  // Phase 10 — Initial enquiries
  PM14: ["Your solicitor has raised the initial enquiries.", "The buyer's solicitor has raised the initial enquiries."],
  VM10: ["Your solicitor has the buyer's initial enquiries.", "The seller's solicitor has received the initial enquiries."],
  VM11: ["Your input on the enquiries is in.", "The seller has given input on the enquiry replies."],
  VM12: ["Your solicitor has sent the formal replies to the buyer's side.", "The seller's solicitor has issued the formal replies."],
  PM15: ["Your solicitor has the seller's formal replies.", "The buyer's solicitor has received the formal replies."],
  PM16: ["Your solicitor has reviewed the seller's replies.", ""],

  // Phase 11 — Further enquiries
  PM17: ["Your solicitor has raised the follow-up enquiries.", "The buyer's solicitor has raised follow-up enquiries."],
  VM13: ["Your solicitor has the buyer's follow-up enquiries.", "The seller's solicitor has received the follow-up enquiries."],
  VM14: ["Your input on the follow-ups is in.", "The seller has given input on the follow-up replies."],
  VM15: ["Your solicitor has sent the follow-up replies.", "The seller's solicitor has issued the follow-up replies."],
  PM18: ["Your solicitor has the seller's follow-up replies.", "The buyer's solicitor has received the follow-up replies."],
  PM19: ["Your solicitor has reviewed the follow-up replies.", ""],
  PM20: ["Your solicitor has confirmed all enquiries are satisfied.", "The buyer's solicitor has confirmed all enquiries are satisfied."],

  // Phase 12 — Final report and contract sign-off
  PM21: ["Your solicitor's final report has landed.", "The buyer has the final report."],
  VM16: ["Your contracts are ready for signing.", "The seller's contracts are with them for signing."],
  VM17: ["Your signed contracts are back with your solicitor.", ""],
  PM22: ["Your contracts are ready for signing.", "The buyer has their contracts."],
  PM23: ["Your signed contracts are back with your solicitor.", "The buyer's signed contracts are back."],

  // Phase 13 — Deposit
  PM24: ["Your deposit is with your solicitor.", "The buyer's deposit is with their solicitor."],

  // Phase 14 — Ready to exchange
  VM18: ["Your solicitor is ready to exchange.", "The seller's solicitor is ready to exchange."],
  PM25: ["Your solicitor is ready to exchange.", "The buyer's solicitor is ready to exchange."],

  // Phase 15 — Exchange
  VM19: ["Contracts have exchanged, your sale is now legally binding.", ""],
  PM26: ["Contracts have exchanged, your purchase is now legally binding.", ""],

  // Phase 16 — Completion
  VM20: ["Completion has happened, your sale is done.", ""],
  PM27: ["Completion has happened, the property is yours.", ""],
};

// Returns the one-sentence digest summary for a milestone, framed for
// the given recipient. Throws on unknown codes so a missing entry surfaces
// at test time rather than as a blank bullet at 9pm on a Friday.
export function getMilestoneDigestLine(
  milestoneCode: string,
  recipientSide: "vendor" | "purchaser",
): string {
  const pair = DIGEST_LINES[milestoneCode];
  if (!pair) {
    throw new Error(`[milestone-digest] no digest line for code "${milestoneCode}"`);
  }
  const cls = classifyForRecipient(milestoneCode, recipientSide);
  const line = cls === "acted" ? pair[0] : pair[1];
  if (!line) {
    // Should not happen for delivered codes — the per-side lookup is
    // empty only for codes that fire to one side, and the classifier
    // matches. If it does happen, fail loud.
    throw new Error(
      `[milestone-digest] no ${cls} digest line for code "${milestoneCode}" (recipientSide=${recipientSide})`,
    );
  }
  return line;
}

// ─── Digest assembly ─────────────────────────────────────────────────────

const JOURNEY_INDEX: Record<string, number> = (() => {
  const idx: Record<string, number> = {};
  JOURNEY_ORDER.forEach((code, i) => { idx[code] = i; });
  return idx;
})();

// Comparator that orders codes by their position in JOURNEY_ORDER (the
// natural transaction sequence). Codes missing from JOURNEY_ORDER sort
// last (defensive — every shipped code is in JOURNEY_ORDER today).
function compareByJourney(a: string, b: string): number {
  const ai = JOURNEY_INDEX[a] ?? Number.MAX_SAFE_INTEGER;
  const bi = JOURNEY_INDEX[b] ?? Number.MAX_SAFE_INTEGER;
  return ai - bi;
}

export type DigestSection = {
  heading: string;
  items: Array<{ milestoneCode: string; line: string }>;
};

export type AssembledDigest = {
  subject: string;
  text: string;
  html: string;
  acted: DigestSection;
  counterpart: DigestSection;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Builds the two digest sections from a list of payloads. Pure: no I/O,
// no side effects. Caller passes the payloads in any order; the assembler
// sorts each section internally by JOURNEY_ORDER.
//
// All payloads in `rows` must target the same recipient (same
// recipientSide, firstName, address, portalUrl). The caller (drain
// loop) groups by recipientContactId before calling.
//
// Pre-condition: rows.length >= 2. Pre-condition violated → throws (this
// is the digest path; N=1 must not route through here).
export function assembleMilestoneDigest(
  rows: MilestoneDigestPayload[],
): AssembledDigest {
  if (rows.length < 2) {
    throw new Error(`[milestone-digest] assembleMilestoneDigest called with ${rows.length} rows; N>=2 required (N=1 sends as-is)`);
  }

  const first = rows[0];
  const recipientSide = first.recipientSide;
  const address = first.address;
  const firstName = first.firstName;
  const portalUrl = first.portalUrl;

  // Split rows into acted vs counterpart for this recipient. Then sort
  // each by JOURNEY_ORDER — items must read in natural transaction
  // sequence regardless of when the agent ticked them off.
  const actedItems: Array<{ milestoneCode: string; line: string }> = [];
  const counterpartItems: Array<{ milestoneCode: string; line: string }> = [];
  for (const row of rows) {
    const cls = classifyForRecipient(row.milestoneCode, recipientSide);
    const line = getMilestoneDigestLine(row.milestoneCode, recipientSide);
    if (cls === "acted") {
      actedItems.push({ milestoneCode: row.milestoneCode, line });
    } else {
      counterpartItems.push({ milestoneCode: row.milestoneCode, line });
    }
  }
  actedItems.sort((a, b) => compareByJourney(a.milestoneCode, b.milestoneCode));
  counterpartItems.sort((a, b) => compareByJourney(a.milestoneCode, b.milestoneCode));

  // Counterpart-side label uses the OTHER side's role word.
  const counterpartLabel = recipientSide === "vendor" ? "buyer's" : "seller's";

  const acted: DigestSection = {
    heading: "What you've confirmed today:",
    items: actedItems,
  };
  const counterpart: DigestSection = {
    heading: `What's happened on the ${counterpartLabel} side:`,
    items: counterpartItems,
  };

  // ── Plain-text body ─────────────────────────────────────────────────
  const textLines: string[] = [`Hi ${firstName},`, ""];
  if (acted.items.length > 0) {
    textLines.push(acted.heading);
    for (const item of acted.items) textLines.push(`- ${item.line}`);
  }
  if (counterpart.items.length > 0) {
    if (acted.items.length > 0) textLines.push("");
    textLines.push(counterpart.heading);
    for (const item of counterpart.items) textLines.push(`- ${item.line}`);
  }
  textLines.push("");
  textLines.push(`→ View your portal: ${portalUrl}`);
  const text = textLines.join("\n");

  // ── HTML body — branded shell matching the single-event wrapper ────
  //
  // Matches the gradient-header + body-pad + orange-CTA pattern used by
  // richMilestoneEmailHtml in lib/services/portal.ts so single and
  // digest emails read as the same family in the inbox. Without the
  // single-event's per-milestone heroLabel we render "Updates" as the
  // H1 and let the address eyebrow plus the section bullets carry the
  // specifics.
  const sectionHtmls: string[] = [];
  function renderSection(section: DigestSection): void {
    if (section.items.length === 0) return;
    sectionHtmls.push(
      `<p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1a1d29">${escapeHtml(section.heading)}</p>`,
    );
    const lis = section.items
      .map((item) => `<li style="margin:0 0 6px;font-size:14px;line-height:1.6;color:#4a5162">${escapeHtml(item.line)}</li>`)
      .join("");
    sectionHtmls.push(`<ul style="margin:0 0 20px;padding-left:20px">${lis}</ul>`);
  }
  renderSection(acted);
  renderSection(counterpart);

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">
<div style="background:linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%);padding:32px 32px 28px;border-radius:0 0 24px 24px">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75)">${escapeHtml(address)}</p>
  <h1 style="margin:0;font-size:20px;font-weight:700;color:#fff;line-height:1.3">Updates</h1>
</div>
<div style="padding:28px 32px">
  <p style="margin:0 0 16px;font-size:15px">Hi ${escapeHtml(firstName)},</p>
  ${sectionHtmls.join("\n  ")}
  <p style="margin:0 0 28px"><a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:13px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px">View your portal</a></p>
</div>
</body></html>`;

  const subject = `Updates on ${address}`;

  return { subject, text, html, acted, counterpart };
}
