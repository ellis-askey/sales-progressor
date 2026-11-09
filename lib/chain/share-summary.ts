// "Share our latest" — the factual progress block the agent email composer drops
// in when you're emailing another agent in the chain (ChainEmailModal). It reads
// OUR sale's milestones and renders a short, plain update the other agent can act
// on, with no greeting and no sign-off so the sender types around it.
//
// What it shares vs keeps out (founder-agreed, 2026-11-09):
//   IN  — the concrete conveyancing steps that help a neighbour gauge chain
//         timing, with a real date where one exists (survey booked, lender
//         valuation booked, enquiries raised).
//   OUT — exchange and completion as done (a client self-reports those; not ours
//         to relay), any money, ID/AML admin, survey findings, enquiry content,
//         and target/forecast dates. These are simply absent below.
//
// The Next-up line is read from resolveDisplayStages — the SAME merged stage view
// the file's own strip uses — so the two can never disagree.

import { prisma } from "@/lib/prisma";
import {
  resolveDisplayStages,
  type MilestoneRowForStages,
  type PurchaseTypeForStages,
  type DisplayStageKey,
} from "@/lib/milestones/display-stages";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(d: Date): string {
  const x = new Date(d);
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`;
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type Comp = { eventDate: Date | null; completedAt: Date | null };
type LineFn = (c: Comp) => string;

// Plain factual lines, keyed by milestone code. Both-sides equivalents map to one
// neutral phrase (and identical lines de-dupe), so the other agent reads the
// sale's position, not seller-vs-buyer-side mechanics. A code absent here is
// never shared — that is the keep-out list, enforced by omission.
const SHAREABLE: Record<string, LineFn> = {
  VM1: () => "Solicitors instructed",
  PM1: () => "Solicitors instructed",
  VM7: () => "Draft contract pack issued",
  PM7: () => "Draft contract pack issued",
  PM5: () => "Mortgage application submitted",
  PM6: (c) => (c.eventDate ? `Lender valuation booked for ${shortDate(c.eventDate)}` : "Lender valuation booked"),
  PM11: () => "Mortgage offer received",
  PM8: () => "Searches ordered",
  PM13: () => "Search results received",
  PM9: (c) => (c.eventDate ? `Survey booked for ${shortDate(c.eventDate)}` : "Survey booked"),
  PM10: () => "Survey report received",
  VM8: () => "Management pack requested",
  VM9: () => "Management pack received",
  PM12: () => "Management pack received",
  PM14: (c) => (c.completedAt ? `Enquiries raised ${shortDate(c.completedAt)}` : "Enquiries raised"),
  PM20: () => "All enquiries resolved",
  VM21: () => "All enquiries resolved",
  VM16: () => "Contracts out for signing",
  PM22: () => "Contracts out for signing",
  VM17: () => "Contracts signed and returned",
  PM23: () => "Contracts signed and returned",
  PM24: () => "Deposit received",
  VM18: () => "Ready to exchange",
  PM25: () => "Ready to exchange",
};

// The Next-up line is capped at the gating stages (instructed → enquiries). Once
// those are through we say "ready to exchange" and go no further — we never reveal
// exchange or completion, matching the keep-out above.
const GATING_ORDER: DisplayStageKey[] = ["instructed", "draft_pack", "finances", "searches", "enquiries"];
const NEXT_PHRASE: Record<DisplayStageKey, string> = {
  instructed: "getting the solicitors instructed",
  draft_pack: "waiting on the draft contract pack",
  finances: "waiting on the mortgage offer",
  searches: "waiting on search results",
  enquiries: "working through enquiries",
  exchange: "ready to exchange",
  completion: "ready to exchange",
};

/**
 * Build the HTML block for "Share our latest" for one sale, or null if the sale
 * can't be read. The block carries a data-cem-share marker so the composer can
 * replace it on a re-click rather than stacking copies.
 */
export async function buildSaleShareSummary(transactionId: string): Promise<string | null> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      purchaseType: true,
      milestoneCompletions: {
        select: {
          state: true,
          completedAt: true,
          eventDate: true,
          reflected: true,
          milestoneDefinition: { select: { code: true } },
        },
      },
    },
  });
  if (!tx) return null;

  const comps = tx.milestoneCompletions.map((c) => ({
    code: c.milestoneDefinition.code,
    state: c.state,
    completedAt: c.completedAt,
    eventDate: c.eventDate,
    reflected: c.reflected,
  }));

  // Next-up — from the merged stage view, so it matches the file's own strip. The
  // earliest gating stage that isn't done (or skipped); "ready to exchange" once
  // the gating stages are all through.
  const rows: MilestoneRowForStages[] = comps.map((c) => ({
    code: c.code,
    isComplete: c.state === "complete",
    isNotRequired: c.state === "not_required",
    completion: { completedAt: c.completedAt },
  }));
  const stages = resolveDisplayStages(
    rows,
    { expectedExchangeDate: null, overridePredictedDate: null, targetCompletionDate: null },
    (tx.purchaseType as PurchaseTypeForStages | null) ?? null,
  );
  let nextUp = "ready to exchange";
  for (const key of GATING_ORDER) {
    const s = stages.find((x) => x.key === key);
    if (s && s.status !== "complete" && s.status !== "skipped") {
      nextUp = NEXT_PHRASE[key];
      break;
    }
  }

  // Bullets — completed shareable steps, with the auto-completed mirror half of a
  // paired step dropped (reflected), most-recently-logged first, de-duped by text,
  // capped at five, then shown oldest → newest so it reads as a short progress run.
  const done = comps
    .filter((c) => c.state === "complete" && !c.reflected && SHAREABLE[c.code])
    .map((c) => ({ text: SHAREABLE[c.code](c), at: c.completedAt ? new Date(c.completedAt).getTime() : 0 }))
    .sort((a, b) => b.at - a.at);

  const seen = new Set<string>();
  const picked: string[] = [];
  for (const d of done) {
    if (seen.has(d.text)) continue;
    seen.add(d.text);
    picked.push(d.text);
    if (picked.length >= 5) break;
  }
  picked.reverse();

  const line1 = (tx.propertyAddress || "").split(",")[0].trim() || "this sale";
  const bullets = picked.length
    ? picked.map((t) => `<li>${esc(t)}</li>`).join("")
    : "<li>Conveyancing just getting underway</li>";

  return (
    `<div data-cem-share="1">` +
    `<p><strong>Here's where things are with ${esc(line1)}:</strong></p>` +
    `<ul>${bullets}</ul>` +
    `<p>Next up: ${esc(nextUp)}.</p>` +
    `</div>`
  );
}
