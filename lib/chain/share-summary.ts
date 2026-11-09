// "Share our latest" — the factual progress block the agent email composer drops
// in when you're emailing another agent in the chain (ChainEmailModal). It reads
// OUR sale's milestones and renders a short, plain update the other agent can act
// on, with no greeting and no sign-off so the sender types around it.
//
// What it shares vs keeps out (founder-agreed, 2026-11-09):
//   IN  — the concrete conveyancing steps that help a neighbour gauge chain
//         timing, with a real date where one exists (survey booked, lender
//         valuation booked, searches due back, enquiries raised).
//   OUT — exchange and completion as done (a client self-reports those; not ours
//         to relay), any money, ID/AML admin, survey findings, enquiry content,
//         and target/forecast dates. These are simply absent below.
//
// Each conveyancing TRACK shows only its FURTHEST-reached beat, so a later beat
// supersedes an earlier one — "Search results received" replaces "Searches
// ordered", "Mortgage offer received" replaces "application submitted". The
// Next-up line is read from resolveDisplayStages — the SAME merged stage view the
// file's own strip uses — so the two can never disagree.

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
type Ctx = { searchesDueBack: Date | null };
type Beat = { codes: string[]; line: (c: Comp, ctx: Ctx) => string };

// Each track's beats run earliest → furthest. We render only the furthest beat a
// sale has reached (see module header). Both-sides equivalents sit in the same
// beat (VM7/PM7, VM18/PM25 …) so a pair never doubles up. Any code absent from
// every track is never shared — that is the keep-out list, enforced by omission.
const TRACKS: { key: string; beats: Beat[] }[] = [
  { key: "instructed", beats: [{ codes: ["VM1", "PM1"], line: () => "Solicitors instructed" }] },
  {
    key: "contract",
    beats: [
      { codes: ["VM7", "PM7"], line: () => "Draft contract pack issued" },
      { codes: ["VM16", "PM22"], line: () => "Contracts out for signing" },
      { codes: ["VM17", "PM23"], line: () => "Contracts signed and returned" },
    ],
  },
  {
    key: "finances",
    beats: [
      { codes: ["PM5"], line: () => "Mortgage application submitted" },
      { codes: ["PM6"], line: (c) => (c.eventDate ? `Lender valuation booked for ${shortDate(c.eventDate)}` : "Lender valuation booked") },
      { codes: ["PM11"], line: () => "Mortgage offer received" },
    ],
  },
  {
    key: "searches",
    beats: [
      { codes: ["PM8"], line: (_c, ctx) => (ctx.searchesDueBack ? `Searches ordered, due back around ${shortDate(ctx.searchesDueBack)}` : "Searches ordered") },
      { codes: ["PM13"], line: () => "Search results received" },
    ],
  },
  {
    key: "survey",
    beats: [
      { codes: ["PM9"], line: (c) => (c.eventDate ? `Survey booked for ${shortDate(c.eventDate)}` : "Survey booked") },
      { codes: ["PM10"], line: () => "Survey report received" },
    ],
  },
  {
    key: "mgmt",
    beats: [
      { codes: ["VM8"], line: () => "Management pack requested" },
      { codes: ["VM9", "PM12"], line: () => "Management pack received" },
    ],
  },
  {
    key: "enquiries",
    beats: [
      { codes: ["PM14"], line: (c) => (c.completedAt ? `Enquiries raised ${shortDate(c.completedAt)}` : "Enquiries raised") },
      { codes: ["PM20", "VM21"], line: () => "All enquiries resolved" },
    ],
  },
  { key: "deposit", beats: [{ codes: ["PM24"], line: () => "Deposit received" }] },
  { key: "ready", beats: [{ codes: ["VM18", "PM25"], line: () => "Ready to exchange" }] },
];

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
          expectedDate: true,
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
    expectedDate: c.expectedDate,
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

  // Completed, non-mirror rows keyed by code — the raw material for the track walk.
  const completeByCode = new Map<string, Comp>();
  for (const c of comps) {
    if (c.state !== "complete") continue;
    // Prefer the directly-confirmed half of a paired step over its mirror.
    if (completeByCode.has(c.code) && c.reflected) continue;
    completeByCode.set(c.code, { eventDate: c.eventDate, completedAt: c.completedAt });
  }
  // Searches due-back — only meaningful while results aren't in yet.
  const pm13 = comps.find((c) => c.code === "PM13");
  const ctx: Ctx = { searchesDueBack: pm13 && pm13.state !== "complete" ? pm13.expectedDate : null };

  // Per track, take only the FURTHEST beat reached. Earlier beats are superseded.
  const lines: { text: string; at: number }[] = [];
  let nonBaseline = 0;
  for (const track of TRACKS) {
    let reached: { beat: Beat; comp: Comp } | null = null;
    for (const beat of track.beats) {
      const hit = beat.codes.map((code) => completeByCode.get(code)).find(Boolean);
      if (hit) reached = { beat, comp: hit };
    }
    if (!reached) continue;
    if (track.key !== "instructed") nonBaseline += 1;
    lines.push({ text: reached.beat.line(reached.comp, ctx), at: reached.comp.completedAt ? new Date(reached.comp.completedAt).getTime() : 0 });
  }

  // Drop the "Solicitors instructed" baseline once any real progress shows.
  let picked = nonBaseline > 0 ? lines.filter((l) => l.text !== "Solicitors instructed") : lines;
  // Most-recently-reached first, capped, then oldest → newest so it reads as a run.
  picked = picked.sort((a, b) => b.at - a.at).slice(0, 5).reverse();

  const line1 = (tx.propertyAddress || "").split(",")[0].trim() || "this sale";
  const bullets = picked.length
    ? picked.map((p) => `<li>${esc(p.text)}</li>`).join("")
    : "<li>Conveyancing just getting underway</li>";

  return (
    `<div data-cem-share="1">` +
    `<p><strong>Here's where things are with ${esc(line1)}:</strong></p>` +
    `<ul>${bullets}</ul>` +
    `<p>Next up: ${esc(nextUp)}.</p>` +
    `</div>`
  );
}
