// The "Add a demo" showcase — a lived-in, best-practice 3-link chain.
//
// When an agency has no real sales yet, the add-sale page offers "Add a demo",
// which stands up a small chain of fully-recorded example files (fake
// Hertfordshire sales) so a new agency sees a property file — and a working
// chain — in all its glory: captured emails and notes, milestones confirmed by
// the buyer's solicitor / the seller's solicitor / the client via portal / the
// agent, spread across a realistic timeline, with the bottom of the chain
// furthest along and the top with the most to do.
//
// Everything is flagged isDemo + demoExpiresAt (~1 week), excluded from the
// trial anchor / billing / real-sale metrics, and auto-removed by the daily
// cleanup cron (or removed on demand). A real sale the agency adds themselves
// is never a demo and is untouched.
//
// See docs/active/demo-sale/SPEC.md.

import { randomBytes } from "node:crypto";
import type { PurchaseType, Tenure, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createTransaction } from "@/lib/services/transactions";
import { initializeMilestoneCompletions } from "@/lib/services/milestones";
import { evaluateTransactionReminders } from "@/lib/services/reminders";
import { refreshExpectedExchangeDate } from "@/lib/services/exchange-prediction";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { hasSolicitorClause } from "@/lib/updates-copy";
import { getAvatarPublicUrl } from "@/lib/supabase-storage";

// The made-up staff member who "manages" every demo file, so a demo is never
// presented as the real user's own file or photo. Owns the files, authors the
// comms, and is the agent-side confirmer. Excluded from team pickers (User.isDemo).
// The avatar object (Images/Agent.png) is uploaded once per environment to the
// public avatars bucket at this path — see docs/active/ELLIS_MANUAL_TODO.md.
const DEMO_AGENT = { name: "Charlotte Hayes", avatarPath: "demo-agent.png" };

async function ensureDemoAgent(agencyId: string): Promise<string> {
  const email = `demo-agent+${agencyId}@example.com`;
  const image = getAvatarPublicUrl(DEMO_AGENT.avatarPath);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { name: DEMO_AGENT.name, image, isDemo: true } });
    return existing.id;
  }
  const created = await prisma.user.create({
    data: { email, name: DEMO_AGENT.name, role: "negotiator" as UserRole, agencyId, isDemo: true, image },
    select: { id: true },
  });
  return created.id;
}

const DEMO_EXPIRY_DAYS = 7;
const POST_EXCHANGE = new Set(["VM19", "VM20", "PM26", "PM27"]);

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(11, 0, 0, 0);
  return d;
}

// ── Presets ────────────────────────────────────────────────────────────────
// Shared demo solicitor firms (find-or-create singletons — see below).
const DEMO_SOLICITORS = {
  vendor: { firm: "Harpenden & Ellwood LLP", name: "Margaret Ellwood", email: "margaret.ellwood@example.com", phone: "01582 900100" },
  purchaser: { firm: "Verulam Legal", name: "Priya Nair", email: "priya.nair@example.com", phone: "01727 900200" },
};

type Comm = { days: number; method: "email" | "phone" | "sms" | "whatsapp"; dir: "outbound" | "inbound" | "note"; to: "buyer" | "seller" | "both"; subject?: string; content: string };

type FilePreset = {
  address: string;
  pricePence: number;
  vendor: { name: string; email: string; phone: string };
  purchaser: { name: string; email: string; phone: string };
  completeFraction: number;
  ageDays: number;
  comms: Comm[];
  attachMos?: boolean;
};

// The star of the show — 14 Beaumont Rise, the middle of the chain.
export const DEMO_PRESET = {
  address: "14 Beaumont Rise, Harpenden, Hertfordshire, AL5 2RT",
  purchasePricePence: 62_500_000,
  tenure: "freehold" as const,
  purchaseType: "mortgage" as const,
  photoStoragePath: "demo/house.png",
  vendor: DEMO_SOLICITORS.vendor,
  purchaser: DEMO_SOLICITORS.purchaser,
  mos: { storagePath: "demo/mos.pdf", filename: "Memorandum of Sale - 14 Beaumont Rise.pdf", mimeType: "application/pdf", fileSize: 23650 },
};

const MIDDLE: FilePreset = {
  address: "14 Beaumont Rise, Harpenden, Hertfordshire, AL5 2RT",
  pricePence: 62_500_000,
  vendor: { name: "Sarah Whitfield", email: "sarah.whitfield@example.com", phone: "07700 900123" },
  purchaser: { name: "Daniel Okafor", email: "daniel.okafor@example.com", phone: "07700 900456" },
  completeFraction: 0.62,
  ageDays: 46,
  attachMos: true,
  comms: [
    { days: 45, method: "email", dir: "outbound", to: "both", subject: "Your sale is underway", content: "Hi Sarah, we've started progressing 14 Beaumont Rise. Next we'll get both solicitors instructed. We'll keep you posted at every step, so you never have to chase us." },
    { days: 42, method: "email", dir: "outbound", to: "both", subject: "Solicitors instructed", content: "Both solicitors are instructed. Harpenden & Ellwood are acting for you, Verulam Legal for Daniel. We've asked them to confirm receipt of the contract pack." },
    { days: 36, method: "phone", dir: "outbound", to: "buyer", content: "Called Verulam Legal. Searches ordered today, expecting them back in three to four weeks." },
    { days: 31, method: "whatsapp", dir: "outbound", to: "seller", content: "Quick update: enquiries have gone over to your solicitor. Nothing needed from you right now, we'll flag it the moment there's anything to do." },
    { days: 27, method: "email", dir: "inbound", to: "buyer", subject: "Re: Mortgage", content: "Morning, the valuation went through fine and my mortgage offer came in today. I've forwarded it to Verulam. Daniel." },
    { days: 24, method: "email", dir: "outbound", to: "buyer", subject: "Mortgage offer received", content: "Great news Daniel, we've logged your mortgage offer and confirmed it's landed with both solicitors. One more box ticked." },
    { days: 17, method: "phone", dir: "note", to: "both", content: "Chased Harpenden & Ellwood for the management pack. Margaret promised it by end of the week." },
    { days: 9, method: "whatsapp", dir: "inbound", to: "seller", content: "Thank you for keeping us in the loop, it's so much less stressful this way. Sarah." },
    { days: 4, method: "email", dir: "outbound", to: "both", subject: "Down to the last enquiries", content: "We're on the final couple of enquiries. Once they're signed off we'll start firming up exchange dates. We'll call you both before anything is agreed." },
  ],
};

// Above the middle in the chain (top, most to do): Sarah's onward purchase.
const TOP: FilePreset = {
  address: "22 Rothamsted Avenue, Harpenden, Hertfordshire, AL5 2DZ",
  pricePence: 79_500_000,
  vendor: { name: "Anne Hale", email: "anne.hale@example.com", phone: "07700 900789" },
  purchaser: { name: "Sarah Whitfield", email: "sarah.whitfield@example.com", phone: "07700 900123" },
  completeFraction: 0.24,
  ageDays: 17,
  comms: [
    { days: 16, method: "email", dir: "outbound", to: "both", subject: "Welcome, your purchase is underway", content: "Hi Sarah, we've set up 22 Rothamsted Avenue as your onward purchase. We'll instruct solicitors this week and line it up behind your sale of Beaumont Rise." },
    { days: 8, method: "phone", dir: "outbound", to: "buyer", content: "Spoke to Sarah about timing. Happy to move at the pace of the chain below, no rush on her end." },
  ],
};

// Below the middle in the chain (bottom, furthest along): Daniel's buyer.
const BOTTOM: FilePreset = {
  address: "3 Leyton Court, St Albans, Hertfordshire, AL1 3XN",
  pricePence: 41_000_000,
  vendor: { name: "Daniel Okafor", email: "daniel.okafor@example.com", phone: "07700 900456" },
  purchaser: { name: "Chloe Bennett", email: "chloe.bennett@example.com", phone: "07700 900321" },
  completeFraction: 0.9,
  ageDays: 84,
  comms: [
    { days: 80, method: "email", dir: "outbound", to: "both", subject: "Your purchase is underway", content: "Hi Chloe, welcome. We've started on 3 Leyton Court. As a first-time buyer you're the foundation of the chain, so getting you moving keeps everyone above you moving too." },
    { days: 40, method: "whatsapp", dir: "outbound", to: "buyer", content: "Searches back and all clear, enquiries answered. Your solicitor is happy. We're into the final stretch now." },
    { days: 6, method: "email", dir: "inbound", to: "buyer", subject: "Re: Exchange", content: "Everything's signed my end and my deposit is with the solicitor. Ready whenever the chain is. Chloe." },
  ],
};

// ── Solicitor singletons ─────────────────────────────────────────────────────
async function ensureDemoSolicitors() {
  async function ensure(firm: string, sol: { name: string; email: string; phone: string }) {
    const firmRow = await prisma.solicitorFirm.upsert({ where: { name: firm }, update: {}, create: { name: firm }, select: { id: true } });
    let solRow = await prisma.solicitorContact.findFirst({ where: { firmId: firmRow.id, name: sol.name }, select: { id: true } });
    if (!solRow) solRow = await prisma.solicitorContact.create({ data: { firmId: firmRow.id, name: sol.name, email: sol.email, phone: sol.phone }, select: { id: true } });
    return { firmId: firmRow.id, solId: solRow.id };
  }
  const v = await ensure(DEMO_SOLICITORS.vendor.firm, DEMO_SOLICITORS.vendor);
  const p = await ensure(DEMO_SOLICITORS.purchaser.firm, DEMO_SOLICITORS.purchaser);
  return { vFirmId: v.firmId, vSolId: v.solId, pFirmId: p.firmId, pSolId: p.solId };
}

type Sols = Awaited<ReturnType<typeof ensureDemoSolicitors>>;

// ── One file in the chain ────────────────────────────────────────────────────
async function buildDemoFile(preset: FilePreset, agencyId: string, agentUserId: string, sols: Sols) {
  const createdAt = daysAgo(preset.ageDays);
  const tx = await createTransaction({
    propertyAddress: preset.address,
    agencyId,
    agentUserId,
    progressedBy: "agent",
    createdAt,
    purchasePrice: preset.pricePence,
    tenure: "freehold" as Tenure,
    purchaseType: "mortgage" as PurchaseType,
    vendorSolicitorFirmId: sols.vFirmId,
    vendorSolicitorContactId: sols.vSolId,
    purchaserSolicitorFirmId: sols.pFirmId,
    purchaserSolicitorContactId: sols.pSolId,
    isDemo: true,
  });

  await prisma.propertyTransaction.update({
    where: { id: tx.id },
    // Keep createTransaction's +7d expiry (stamped from real now, not the
    // backdated createdAt): the demo auto-removes after ~1 week via the daily
    // demo-cleanup cron. By then the agency has usually added a real sale (so
    // the "Explore demo" affordance is already gone); if they haven't, the
    // demo clears and the button reappears. Restores SPEC.md behaviour after a
    // 2026-08-30 experiment that nulled it. (Decision D7, 2026-09-02.)
    data: { photoStoragePath: DEMO_PRESET.photoStoragePath, lastActivityAt: daysAgo(1) },
  });

  const vendor = await prisma.contact.create({
    data: { propertyTransactionId: tx.id, roleType: "vendor", name: preset.vendor.name, email: preset.vendor.email, phone: preset.vendor.phone, portalToken: randomBytes(20).toString("base64url") },
    select: { id: true },
  });
  const purchaser = await prisma.contact.create({
    data: { propertyTransactionId: tx.id, roleType: "purchaser", name: preset.purchaser.name, email: preset.purchaser.email, phone: preset.purchaser.phone, portalToken: randomBytes(20).toString("base64url") },
    select: { id: true },
  });

  if (preset.attachMos) {
    await prisma.transactionDocument.create({
      data: { transactionId: tx.id, filename: DEMO_PRESET.mos.filename, storagePath: DEMO_PRESET.mos.storagePath, fileSize: DEMO_PRESET.mos.fileSize, mimeType: DEMO_PRESET.mos.mimeType, source: "mos" },
    }).catch((e) => console.error("[demo] MOS attach failed", e));
  }

  await seedMilestones(tx.id, preset, agentUserId, tx.activeBuyerRoundId ?? null, sols, { vendorId: vendor.id, purchaserId: purchaser.id });
  await seedComms(tx.id, agencyId, agentUserId, preset.comms, { vendorId: vendor.id, purchaserId: purchaser.id, vendorName: preset.vendor.name, purchaserName: preset.purchaser.name });
  await refreshExpectedExchangeDate(tx.id).catch(() => {});

  return { txId: tx.id, roundId: tx.activeBuyerRoundId ?? null };
}

// Complete a best-practice progression with lifelike dates and varied
// confirmers (agent / buyer's or seller's solicitor / client via portal).
async function seedMilestones(
  transactionId: string,
  preset: FilePreset,
  agentUserId: string,
  roundId: string | null,
  sols: Sols,
  contacts: { vendorId: string; purchaserId: string },
) {
  await initializeMilestoneCompletions(transactionId, "freehold" as Tenure, "mortgage" as PurchaseType, agentUserId, roundId ?? undefined, prisma);

  const rows = await prisma.milestoneCompletion.findMany({
    where: { transactionId },
    select: { id: true, state: true, milestoneDefinition: { select: { code: true, side: true, orderIndex: true } } },
  });
  const nrCodes = new Set(rows.filter((r) => r.state === "not_required").map((r) => r.milestoneDefinition?.code).filter(Boolean) as string[]);

  const eligible = rows
    .filter((r) => r.milestoneDefinition && r.state !== "not_required" && !POST_EXCHANGE.has(r.milestoneDefinition.code))
    .map((r) => ({ id: r.id, code: r.milestoneDefinition!.code, side: r.milestoneDefinition!.side, orderIndex: r.milestoneDefinition!.orderIndex }));

  // Pick the first `fraction` of each side, in order.
  const bySide: Record<string, typeof eligible> = {};
  for (const e of eligible) (bySide[e.side] ??= []).push(e);
  const completed: typeof eligible = [];
  for (const list of Object.values(bySide)) {
    list.sort((a, b) => a.orderIndex - b.orderIndex);
    completed.push(...list.slice(0, Math.floor(list.length * preset.completeFraction)));
  }
  const completedCodes = new Set(completed.map((c) => c.code));

  // Apply completions, oldest-first, with spread dates + varied confirmers.
  completed.sort((a, b) => a.orderIndex - b.orderIndex);
  const span = Math.max(preset.ageDays - 1, 1);
  for (let i = 0; i < completed.length; i++) {
    const c = completed[i];
    const offset = Math.round(span - (i / Math.max(completed.length - 1, 1)) * (span - 1));
    let channel = i % 4 === 1 ? "solicitor" : i % 4 === 3 ? "portal" : "agent";
    // Only attribute a solicitor confirm to a step a solicitor actually confirms.
    if (channel === "solicitor" && !hasSolicitorClause(c.code)) channel = "agent";
    let attribution: Record<string, unknown>;
    if (channel === "solicitor") {
      attribution = c.side === "purchaser"
        ? { completedById: null, confirmedBySolicitorFirmId: sols.pFirmId, confirmedBySolicitorContactId: sols.pSolId }
        : { completedById: null, confirmedBySolicitorFirmId: sols.vFirmId, confirmedBySolicitorContactId: sols.vSolId };
    } else if (channel === "portal") {
      attribution = { completedById: null, confirmedByPortal: true, confirmedByContactId: c.side === "purchaser" ? contacts.purchaserId : contacts.vendorId };
    } else {
      attribution = { completedById: agentUserId };
    }
    await prisma.milestoneCompletion.update({
      where: { id: c.id },
      data: { state: "complete", completedAt: daysAgo(offset), ...attribution },
    });
  }

  // Coherent states for the rest: available when all prereqs are done, else locked.
  const availableIds: string[] = [];
  const lockedIds: string[] = [];
  for (const e of eligible) {
    if (completedCodes.has(e.code)) continue;
    const prereqs = DIRECT_PREREQUISITES[e.code] ?? [];
    const ready = prereqs.every((p) => completedCodes.has(p) || nrCodes.has(p));
    (ready ? availableIds : lockedIds).push(e.id);
  }
  if (availableIds.length) await prisma.milestoneCompletion.updateMany({ where: { id: { in: availableIds } }, data: { state: "available" } });
  if (lockedIds.length) await prisma.milestoneCompletion.updateMany({ where: { id: { in: lockedIds } }, data: { state: "locked" } });
}

async function seedComms(
  transactionId: string,
  agencyId: string,
  agentUserId: string,
  comms: Comm[],
  ctx: { vendorId: string; purchaserId: string; vendorName: string; purchaserName: string },
) {
  for (const c of comms) {
    const recipients = c.to === "buyer" ? [ctx.purchaserId] : c.to === "seller" ? [ctx.vendorId] : [ctx.purchaserId, ctx.vendorId];
    const type = c.dir === "note" ? "internal_note" : c.dir === "inbound" ? "inbound" : "outbound";
    const senderName = c.to === "seller" ? ctx.vendorName : ctx.purchaserName;
    await prisma.outboundMessage.create({
      data: {
        transactionId,
        agencyId,
        type,
        method: c.method,
        channel: c.method === "email" ? "email" : c.method === "sms" || c.method === "whatsapp" ? "sms" : "other",
        purpose: "chase",
        status: "sent",
        subject: c.subject,
        content: c.content,
        contactIds: c.dir === "note" ? [] : recipients,
        // Inbound rows come FROM the contact: no createdById, name via senderLabel.
        createdById: c.dir === "inbound" ? null : agentUserId,
        createdByRole: c.dir === "inbound" ? null : "director",
        senderLabel: c.dir === "inbound" ? senderName : null,
        // Client-visible: real outbound updates show on the client's feed; notes don't.
        visibleToClient: c.dir === "outbound",
        createdAt: daysAgo(c.days),
        updatedAt: daysAgo(c.days),
        sentAt: daysAgo(c.days),
      },
    });
  }
}

// ── The chain ────────────────────────────────────────────────────────────────
// DB position 0 = top of chain (most to do); highest position = bottom (furthest
// along). See lib/chain/positions.ts.
async function buildChain(topTxId: string, midTxId: string, botTxId: string, agencyId: string, agentUserId: string) {
  const chain = await prisma.propertyChain.create({
    data: { agencyId, name: "Beaumont Rise chain", createdByUserId: agentUserId, status: "ACTIVE" },
    select: { id: true },
  });
  const order: [string, number, number][] = [
    [topTxId, 0, 17],
    [midTxId, 1, 42],
    [botTxId, 2, 80],
  ];
  for (const [txId, position, claimedDaysAgo] of order) {
    const link = await prisma.chainLink.create({
      data: {
        chainId: chain.id,
        position,
        createdByUserId: agentUserId,
        transactionId: txId,
        claimedByUserId: agentUserId,
        claimedAt: daysAgo(claimedDaysAgo),
        inviteStatus: "CLAIMED",
      },
      select: { id: true },
    });
    await prisma.propertyTransaction.update({ where: { id: txId }, data: { chainLinkId: link.id } });
  }
}

/**
 * Stand up the demo showcase chain for an agency. Returns the middle
 * transaction id (the one to open). Callers must guard that the agency has no
 * real sales and no existing demo (see addDemoSaleAction).
 */
export async function createDemoSale(opts: { agencyId: string; agentUserId: string }): Promise<string> {
  const sols = await ensureDemoSolicitors();
  // Every demo file is owned + managed + confirmed by the made-up demo agent,
  // never the real user, so it can't read as "their file".
  const demoAgentId = await ensureDemoAgent(opts.agencyId);
  // Sequential (not Promise.all) so we don't run three heavy createTransaction
  // $transactions concurrently against the pooler.
  const top = await buildDemoFile(TOP, opts.agencyId, demoAgentId, sols);
  const middle = await buildDemoFile(MIDDLE, opts.agencyId, demoAgentId, sols);
  const bottom = await buildDemoFile(BOTTOM, opts.agencyId, demoAgentId, sols);
  await buildChain(top.txId, middle.txId, bottom.txId, opts.agencyId, demoAgentId);

  // The star file (the one the agent opens) is brought fully to life: run the
  // real reminder engine once so the Reminders tab and the Chase timeline show
  // live threads driven off the seeded milestone state, and add one open To-Do.
  // Nothing sends — demo files are excluded from the client/solicitor chase
  // crons, and the reserved-@example.com backstop drops any stray send.
  await seedStarFileActivity(middle.txId, opts.agencyId, demoAgentId);

  return middle.txId;
}

// Bring the opened demo file to life on the three tabs the base seed leaves
// empty (Reminders / Chase timeline / To-Do). Star file only — the top and
// bottom of the chain stay quieter, which reads fine (they aren't opened).
async function seedStarFileActivity(txId: string, agencyId: string, agentUserId: string) {
  // Real chase engine: creates ReminderLog rows (each = one chase thread) from
  // the file's available milestones. Best-effort; a demo must still stand up if
  // the reminder rules aren't seeded in this environment.
  await evaluateTransactionReminders(txId).catch((e) => console.error("[demo] reminder eval failed", e));

  // One open To-Do so the tab isn't empty. isAgentRequest:false — a normal
  // agent task, not an internal-team request. Cascades on file delete.
  await prisma.manualTask
    .create({
      data: {
        agencyId,
        transactionId: txId,
        title: "Confirm preferred exchange date with Sarah",
        notes: "She asked to avoid the last week of the month. Call once the final enquiries are signed off.",
        status: "open",
        isAgentRequest: false,
        createdById: agentUserId,
        dueDate: daysAgo(-3), // a few days out
      },
    })
    .catch((e) => console.error("[demo] manual task seed failed", e));
}

// ── Removal (chain-aware: links → chain → transactions, per seed teardown) ────
async function deleteDemoTransactions(txIds: string[]): Promise<void> {
  if (txIds.length === 0) return;
  const links = await prisma.chainLink.findMany({ where: { transactionId: { in: txIds } }, select: { chainId: true } });
  const chainIds = [...new Set(links.map((l) => l.chainId))];
  await prisma.$transaction([
    prisma.chainLink.deleteMany({ where: { chainId: { in: chainIds } } }),
    prisma.propertyChain.deleteMany({ where: { id: { in: chainIds } } }),
    prisma.propertyTransaction.deleteMany({ where: { id: { in: txIds } } }),
  ]);
}

/** Remove every demo file whose expiry has passed (daily cron). */
export async function cleanupExpiredDemos(now: Date = new Date()): Promise<{ removed: number }> {
  const expired = await prisma.propertyTransaction.findMany({
    where: { isDemo: true, demoExpiresAt: { not: null, lte: now } },
    select: { id: true },
  });
  const ids = expired.map((t) => t.id);
  try {
    await deleteDemoTransactions(ids);
    return { removed: ids.length };
  } catch (err) {
    console.error("[cleanupExpiredDemos] failed", err);
    return { removed: 0 };
  }
}

/**
 * Remove the whole demo set for an agency on request (the "Remove now" button).
 * A demo is a chain of files, so this removes all of the agency's demo files.
 * Returns true if it removed anything.
 */
export async function removeDemoSale(_transactionId: string, agencyId: string): Promise<boolean> {
  const demos = await prisma.propertyTransaction.findMany({ where: { agencyId, isDemo: true }, select: { id: true } });
  if (demos.length === 0) return false;
  await deleteDemoTransactions(demos.map((d) => d.id));
  return true;
}
