// The "Add a demo" showcase file.
//
// When an agency has no real sales yet, the add-sale page offers "Add a demo",
// which stands up ONE fully-populated, best-practice example file (fake
// Hertfordshire sale) so a new agency can see a property file "in all its
// glory" before committing their own. It is flagged isDemo + demoExpiresAt
// (~1 week), excluded from the trial anchor / billing / real-sale metrics, and
// auto-removed by the weekly cleanup cron (or removed manually by the agent).
//
// A real sale the agency adds themselves is never a demo and is untouched by
// any of this.
//
// See docs/active/demo-sale/SPEC.md.

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createTransaction } from "@/lib/services/transactions";
import { initializeMilestoneCompletions } from "@/lib/services/milestones";
import { refreshExpectedExchangeDate } from "@/lib/services/exchange-prediction";

// The canonical demo content. Fully invented — a best-practice Hertfordshire
// sale. The memorandum of sale is generated from these details and attached
// separately (see SPEC.md). Kept as one constant so the preset, the seed, and
// any future "reset the demo" tooling agree on exactly one showcase file.
export const DEMO_PRESET = {
  address: "14 Beaumont Rise, Harpenden, Hertfordshire, AL5 2RT",
  purchasePricePence: 62_500_000, // £625,000
  tenure: "freehold" as const,
  purchaseType: "mortgage" as const,
  // Shared storage object every demo file points at (uploaded once per
  // environment — see docs/active/ELLIS_MANUAL_TODO.md for the prod upload).
  photoStoragePath: "demo/house.png",
  vendor: { name: "Sarah Whitfield", email: "sarah.whitfield@example.com", phone: "07700 900123" },
  purchaser: { name: "Daniel Okafor", email: "daniel.okafor@example.com", phone: "07700 900456" },
  vendorSolicitor: { firm: "Harpenden & Ellwood LLP", name: "Margaret Ellwood", email: "margaret.ellwood@example.com", phone: "01582 900100" },
  purchaserSolicitor: { firm: "Verulam Legal", name: "Priya Nair", email: "priya.nair@example.com", phone: "01727 900200" },
  // Shared memorandum-of-sale document every demo points at (uploaded once per
  // environment to demo/mos.pdf, same as the photo).
  mos: { storagePath: "demo/mos.pdf", filename: "Memorandum of Sale - 14 Beaumont Rise.pdf", mimeType: "application/pdf", fileSize: 23650 },
};

// Backdate the file so its milestones read as real ongoing work, not a single
// big-bang today. ~45 days in gives a file through the legal work, approaching
// exchange — the state that lights up the most of the product.
const DEMO_AGE_DAYS = 45;
// Complete this fraction of each side's applicable (non-NR, non-post-exchange)
// milestones, in order, so it reads as a well-progressed live file.
const DEMO_COMPLETE_FRACTION = 0.65;
const POST_EXCHANGE = new Set(["VM19", "VM20", "PM26", "PM27"]);

/**
 * Create the demo showcase file for an agency. Returns the new transaction id.
 * Callers must guard that the agency has no real sales and no existing demo
 * (see addDemoSaleAction).
 */
// Find-or-create the shared demo solicitor firms + handlers. Reused by every
// demo (SolicitorFirm.name is unique), so they are singletons and are never
// deleted when a demo is removed.
async function ensureDemoSolicitors(): Promise<{ vFirmId: string; vSolId: string; pFirmId: string; pSolId: string }> {
  async function ensure(firm: string, sol: { name: string; email: string; phone: string }) {
    const firmRow = await prisma.solicitorFirm.upsert({
      where: { name: firm },
      update: {},
      create: { name: firm },
      select: { id: true },
    });
    let solRow = await prisma.solicitorContact.findFirst({
      where: { firmId: firmRow.id, name: sol.name },
      select: { id: true },
    });
    if (!solRow) {
      solRow = await prisma.solicitorContact.create({
        data: { firmId: firmRow.id, name: sol.name, email: sol.email, phone: sol.phone },
        select: { id: true },
      });
    }
    return { firmId: firmRow.id, solId: solRow.id };
  }
  const v = await ensure(DEMO_PRESET.vendorSolicitor.firm, DEMO_PRESET.vendorSolicitor);
  const p = await ensure(DEMO_PRESET.purchaserSolicitor.firm, DEMO_PRESET.purchaserSolicitor);
  return { vFirmId: v.firmId, vSolId: v.solId, pFirmId: p.firmId, pSolId: p.solId };
}

export async function createDemoSale(opts: { agencyId: string; agentUserId: string }): Promise<string> {
  const createdAt = new Date(Date.now() - DEMO_AGE_DAYS * 24 * 60 * 60 * 1000);

  // Solicitor firms + handlers. SolicitorFirm.name is globally unique, and
  // multiple demos (different agencies) share the same fake firms, so these are
  // find-or-create singletons — reused across demos and never deleted on
  // cleanup (only the demo transaction is removed).
  const { vFirmId, vSolId, pFirmId, pSolId } = await ensureDemoSolicitors();

  // The file itself, via the canonical create (round + chase snapshot + event).
  // isDemo makes it skip the trial anchor + payment block and stamp demoExpiresAt.
  const tx = await createTransaction({
    propertyAddress: DEMO_PRESET.address,
    agencyId: opts.agencyId,
    agentUserId: opts.agentUserId,
    progressedBy: "agent",
    createdAt,
    purchasePrice: DEMO_PRESET.purchasePricePence,
    tenure: DEMO_PRESET.tenure,
    purchaseType: DEMO_PRESET.purchaseType,
    vendorSolicitorFirmId: vFirmId,
    vendorSolicitorContactId: vSolId,
    purchaserSolicitorFirmId: pFirmId,
    purchaserSolicitorContactId: pSolId,
    isDemo: true,
  });

  // Property photo + client contacts.
  await prisma.propertyTransaction.update({
    where: { id: tx.id },
    data: { photoStoragePath: DEMO_PRESET.photoStoragePath },
  });
  await prisma.contact.create({
    data: {
      propertyTransactionId: tx.id, roleType: "vendor",
      name: DEMO_PRESET.vendor.name, email: DEMO_PRESET.vendor.email, phone: DEMO_PRESET.vendor.phone,
      portalToken: randomBytes(20).toString("base64url"),
    },
  });
  await prisma.contact.create({
    data: {
      propertyTransactionId: tx.id, roleType: "purchaser",
      name: DEMO_PRESET.purchaser.name, email: DEMO_PRESET.purchaser.email, phone: DEMO_PRESET.purchaser.phone,
      portalToken: randomBytes(20).toString("base64url"),
    },
  });

  // Attach the memorandum of sale (points at the shared demo/mos.pdf object).
  await prisma.transactionDocument.create({
    data: {
      transactionId: tx.id,
      filename: DEMO_PRESET.mos.filename,
      storagePath: DEMO_PRESET.mos.storagePath,
      fileSize: DEMO_PRESET.mos.fileSize,
      mimeType: DEMO_PRESET.mos.mimeType,
      source: "mos",
    },
  }).catch((err) => console.error("[createDemoSale] MOS attach failed", err));

  // Milestones: initialise the full engine, then complete a best-practice
  // progression with completedAt spread across the file's life.
  await initializeMilestoneCompletions(
    tx.id, DEMO_PRESET.tenure, DEMO_PRESET.purchaseType, opts.agentUserId, tx.activeBuyerRoundId ?? undefined, prisma,
  );

  const rows = await prisma.milestoneCompletion.findMany({
    where: { transactionId: tx.id },
    select: { id: true, state: true, milestoneDefinition: { select: { code: true, side: true, orderIndex: true } } },
  });
  // Eligible = not auto-NR, not a post-exchange step. Ordered per side.
  const bySide: Record<string, { id: string; orderIndex: number }[]> = {};
  for (const r of rows) {
    const code = r.milestoneDefinition?.code;
    if (!code || r.state === "not_required" || POST_EXCHANGE.has(code)) continue;
    (bySide[r.milestoneDefinition!.side] ??= []).push({ id: r.id, orderIndex: r.milestoneDefinition!.orderIndex });
  }
  const toComplete: string[] = [];
  for (const list of Object.values(bySide)) {
    list.sort((a, b) => a.orderIndex - b.orderIndex);
    const n = Math.floor(list.length * DEMO_COMPLETE_FRACTION);
    list.slice(0, n).forEach((r) => toComplete.push(r.id));
  }
  const spanMs = Date.now() - createdAt.getTime();
  for (let i = 0; i < toComplete.length; i++) {
    const at = new Date(createdAt.getTime() + Math.round((spanMs * (i + 1)) / (toComplete.length + 1)));
    await prisma.milestoneCompletion.update({
      where: { id: toComplete[i] },
      data: { state: "complete", completedAt: at, completedById: opts.agentUserId },
    });
  }

  // Write the live prediction onto the stored date so it reads realistically.
  await refreshExpectedExchangeDate(tx.id).catch(() => {});

  return tx.id;
}

/**
 * Remove every demo file whose expiry has passed. Called by the daily cron and
 * safe to run any time. PropertyTransaction delete cascades to its owned rows
 * (rounds, milestones, contacts); the fake solicitor firms this demo created
 * are cleaned up best-effort afterwards. Returns how many were removed.
 */
export async function cleanupExpiredDemos(now: Date = new Date()): Promise<{ removed: number }> {
  const expired = await prisma.propertyTransaction.findMany({
    where: { isDemo: true, demoExpiresAt: { not: null, lte: now } },
    select: { id: true },
  });

  let removed = 0;
  for (const tx of expired) {
    try {
      // Only the transaction (cascades its rounds / milestones / contacts). The
      // shared demo solicitor firms are singletons and are left in place.
      await prisma.propertyTransaction.delete({ where: { id: tx.id } });
      removed++;
    } catch (err) {
      console.error(`[cleanupExpiredDemos] failed to remove demo ${tx.id}`, err);
    }
  }
  return { removed };
}

/**
 * Remove a single demo file on request (the agent's "remove now" action).
 * Guards that the file really is a demo and belongs to the agency. Returns
 * true if it removed something.
 */
export async function removeDemoSale(transactionId: string, agencyId: string): Promise<boolean> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId, isDemo: true },
    select: { id: true },
  });
  if (!tx) return false;
  // Shared demo solicitor firms are singletons — leave them; remove only the file.
  await prisma.propertyTransaction.delete({ where: { id: tx.id } });
  return true;
}
