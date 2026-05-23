// One-shot staging seed for spot-checking the chase-pipeline UI on three
// existing Hartwell & Partners transactions. Each transaction demonstrates
// a different set of features so Ellis can see them in practice.
//
// SCENARIOS:
//
//   1. 40 Tresco Road, Berkhamsted (cmpfbdh5b0001d9y8lh901sbh)
//      Demonstrates: REPEAT-chase predictions in the Upcoming section +
//      a "Sent today" row in the drawer + amber/green chips on milestone
//      rows. Two CCS rows seeded (VM1 chase 1, PM1 chase 1 with recent
//      engagement) plus one OutboundEmailQueue row marked as sent today.
//
//   2. 73 Jutland House (cmpfbzxgr00016fb29e9w9f8b)
//      Demonstrates: ESCALATED grey chip + ENGAGED green chip on milestone
//      rows. Two CCS rows seeded (VM1 escalated, PM1 active with engagement
//      after last chase).
//
//   3. 39a Darnley Road, Gravesend (cmpf7o8u40005136353v6b2l2)
//      Demonstrates: FIRST-CHASE prediction (the just-shipped feature).
//      VM1's MilestoneCompletion is updated to state="complete" with a
//      recent completedAt, and VM3 is upserted to state="available" so
//      the predictor produces a clean future first-chase prediction for
//      Mr Stevens / Miss Adele Maxwell-Harrison.
//
// SAFE BY DESIGN:
//   - dotenv override + hard-abort guard against the production project ID
//   - Built-in cleanup mode (`--cleanup`) that reverses every change
//   - MilestoneCompletion modifications are tracked + restored exactly
//
// Run: npx tsx scripts/seed-staging-spot-check.ts
// Undo: npx tsx scripts/seed-staging-spot-check.ts --cleanup

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { prisma } from "../lib/prisma";

const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";

const STAGING_URL = "https://salesprogressor-git-staging-ellis-askeys-projects.vercel.app";

// Hartwell & Partners transactions (already in the staging DB).
const TX_TRESCO  = "cmpfbdh5b0001d9y8lh901sbh"; // 40 Tresco Road
const TX_JUTLAND = "cmpfbzxgr00016fb29e9w9f8b"; // 73 Jutland House
const TX_DARNLEY = "cmpf7o8u40005136353v6b2l2"; // 39a Darnley Road

const ALL_TX_IDS = [TX_TRESCO, TX_JUTLAND, TX_DARNLEY];

const SEED_TAG = "SEED-SPOT-CHECK";

function daysAgo(n: number, hour = 9): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}
function todayAt(hour: number): Date {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

async function preflight() {
  const dbUrl = process.env.DATABASE_URL || "";
  const m = dbUrl.match(/postgres\.([^:]+):/);
  const projectId = m ? m[1] : "unknown";
  console.log(`[spot-check] DB project: ${projectId}`);
  if (projectId === PROD_PROJECT_ID) {
    console.error(`[spot-check] HARD ABORT: connected to PRODUCTION (${PROD_PROJECT_ID})`);
    process.exit(1);
  }
  if (projectId !== STAGING_PROJECT_ID) {
    console.error(`[spot-check] HARD ABORT: not staging (got "${projectId}")`);
    process.exit(1);
  }
}

// Returns the vendor + purchaser contacts on a transaction. Existing
// Hartwell fixture contacts mostly have portalToken but NULL email — the
// chase pipeline's email requirement would skip them. For demo purposes
// we set a placeholder email (restored on cleanup) so the eligibility
// filter passes. Contacts with NULL portalToken are still filtered out;
// nothing we seed creates them.
async function loadAndPrepContacts(transactionId: string) {
  const contacts = await prisma.contact.findMany({
    where: {
      propertyTransactionId: transactionId,
      roleType: { in: ["vendor", "purchaser"] },
      portalToken: { not: null },
      unsubscribedAt: null,
    },
    select: { id: true, name: true, roleType: true, email: true, portalToken: true },
  });
  const vendor = contacts.find((c) => c.roleType === "vendor");
  const purchaser = contacts.find((c) => c.roleType === "purchaser");
  return { vendor, purchaser, all: contacts };
}

// Set a placeholder email on a contact (only if currently NULL). The
// cleanup function clears it back to NULL. Local-only address — chase
// pipeline is flag-gated OFF on staging so no risk of accidental send,
// and the OutboundEmailQueue rows we create are pre-marked sentAt so the
// drain cron won't touch them either.
async function ensureContactEmail(contactId: string, current: string | null): Promise<string> {
  if (current) return current;
  const placeholder = `seed-${contactId.slice(0, 8)}@spot-check.test`;
  await prisma.contact.update({
    where: { id: contactId },
    data: { email: placeholder },
  });
  return placeholder;
}

async function seed() {
  console.log("");
  console.log("[spot-check] === seeding ===");

  // ─── TX 1 — 40 Tresco Road ────────────────────────────────────────────
  console.log("");
  console.log("[spot-check] 40 Tresco Road (repeat-chase predictions + sent today)");
  {
    const { vendor, purchaser } = await loadAndPrepContacts(TX_TRESCO);
    if (!vendor || !purchaser) {
      console.warn("  ⚠ skipping — vendor or purchaser contact missing");
    } else {
      const vendorEmail = await ensureContactEmail(vendor.id, vendor.email);
      // CCS for VM1, chased 2 days ago → repeat=3 → next chase in ~1 day (today)
      await prisma.clientChaseState.create({
        data: {
          transactionId: TX_TRESCO,
          contactId: vendor.id,
          milestoneCode: "VM1",
          status: "active",
          chaseCount: 1,
          firstChasedAt: daysAgo(2),
          lastChasedAt: daysAgo(2),
        },
      });
      console.log(`  ✓ CCS VM1 (chaseCount=1, lastChasedAt=2d ago) → ${vendor.name}`);

      // CCS for PM1, chased 1 day ago → repeat=3 → next chase in 2 days
      await prisma.clientChaseState.create({
        data: {
          transactionId: TX_TRESCO,
          contactId: purchaser.id,
          milestoneCode: "PM1",
          status: "active",
          chaseCount: 1,
          firstChasedAt: daysAgo(1),
          lastChasedAt: daysAgo(1),
        },
      });
      console.log(`  ✓ CCS PM1 (chaseCount=1, lastChasedAt=1d ago) → ${purchaser.name}`);

      // OutboundEmailQueue row marked as sent today (so the "Sent today"
      // section in the drawer has something to show)
      await prisma.outboundEmailQueue.create({
        data: {
          emailType: "CLIENT_CHASE",
          sourceId: `${SEED_TAG}:${TX_TRESCO}:${vendor.id}:${Date.now()}`,
          recipientEmail: vendorEmail,
          recipientContactId: vendor.id,
          payload: {
            subject: `40 Tresco Road: one update needed`,
            text: "(seed)",
            html: "(seed)",
          },
          scheduledFor: todayAt(9),
          sentAt: todayAt(9),
        },
      });
      console.log(`  ✓ OutboundEmailQueue sent today → ${vendor.name}`);
    }
  }

  // ─── TX 2 — 73 Jutland House ─────────────────────────────────────────
  console.log("");
  console.log("[spot-check] 73 Jutland House (escalated chip + engaged chip)");
  {
    const { vendor, purchaser } = await loadAndPrepContacts(TX_JUTLAND);
    if (!vendor || !purchaser) {
      console.warn("  ⚠ skipping — vendor or purchaser contact missing");
    } else {
      // Escalated CCS — chip flips grey, falls off "upcoming"
      await prisma.clientChaseState.create({
        data: {
          transactionId: TX_JUTLAND,
          contactId: vendor.id,
          milestoneCode: "VM1",
          status: "escalated",
          chaseCount: 2,
          firstChasedAt: daysAgo(12),
          lastChasedAt: daysAgo(8),
        },
      });
      console.log(`  ✓ CCS VM1 status=escalated → ${vendor.name} (grey chip)`);

      // Engaged-after-chase — chip flips green, falls off "upcoming"
      await prisma.clientChaseState.create({
        data: {
          transactionId: TX_JUTLAND,
          contactId: purchaser.id,
          milestoneCode: "PM1",
          status: "active",
          chaseCount: 1,
          firstChasedAt: daysAgo(5),
          lastChasedAt: daysAgo(5),
          lastEngagedAt: daysAgo(2),
        },
      });
      console.log(`  ✓ CCS PM1 active + engaged 2d ago → ${purchaser.name} (green chip)`);
    }
  }

  // ─── TX 3 — 39a Darnley Road ──────────────────────────────────────────
  console.log("");
  console.log("[spot-check] 39a Darnley Road (first-chase prediction — the new piece)");
  {
    const { vendor } = await loadAndPrepContacts(TX_DARNLEY);
    if (!vendor) {
      console.warn("  ⚠ skipping — vendor contact missing");
    } else {
      await ensureContactEmail(vendor.id, vendor.email);
      // To get a clean future first-chase prediction for VM3:
      //   1. VM3's anchor is VM1 (per ReminderRule).
      //   2. VM1 must be state="complete" with a recent completedAt.
      //   3. VM3 must be state="available" so the predictor includes it.
      //
      // Currently on Darnley: VM1 is "available", VM3 has no MC row (locked
      // by state machine). Modify both, restore on cleanup.

      const vm1Def = await prisma.milestoneDefinition.findUnique({ where: { code: "VM1" }, select: { id: true } });
      const vm3Def = await prisma.milestoneDefinition.findUnique({ where: { code: "VM3" }, select: { id: true } });
      if (!vm1Def || !vm3Def) {
        console.warn("  ⚠ skipping — milestone definitions not found");
      } else {
        // Modify VM1: state="available" → state="complete", completedAt=2d ago
        await prisma.milestoneCompletion.update({
          where: {
            transactionId_milestoneDefinitionId: { transactionId: TX_DARNLEY, milestoneDefinitionId: vm1Def.id },
          },
          data: { state: "complete", completedAt: daysAgo(2) },
        });
        console.log(`  ✓ VM1 → state=complete, completedAt=2d ago (anchor for VM3 prediction)`);

        // Upsert VM3 to state="available"
        await prisma.milestoneCompletion.upsert({
          where: {
            transactionId_milestoneDefinitionId: { transactionId: TX_DARNLEY, milestoneDefinitionId: vm3Def.id },
          },
          create: {
            transactionId: TX_DARNLEY,
            milestoneDefinitionId: vm3Def.id,
            state: "available",
          },
          update: { state: "available", completedAt: null, eventDate: null },
        });
        console.log(`  ✓ VM3 → state=available (target of the predicted first chase)`);
        console.log(`  → predicted first chase for "Receive welcome pack" to ${vendor.name} in ~1 day`);
      }
    }
  }

  // ─── Print verification URLs ─────────────────────────────────────────
  console.log("");
  console.log("[spot-check] ─── verification URLs (staging) ────────────────────");
  console.log("");
  console.log("  Agent surface (Hartwell director / negotiator login required):");
  console.log(`    Tresco:  ${STAGING_URL}/agent/transactions/${TX_TRESCO}`);
  console.log(`    Jutland: ${STAGING_URL}/agent/transactions/${TX_JUTLAND}`);
  console.log(`    Darnley: ${STAGING_URL}/agent/transactions/${TX_DARNLEY}`);
  console.log("");
  console.log("  Internal staff surface (admin / sales_progressor login):");
  console.log(`    Tresco:  ${STAGING_URL}/transactions/${TX_TRESCO}`);
  console.log(`    Jutland: ${STAGING_URL}/transactions/${TX_JUTLAND}`);
  console.log(`    Darnley: ${STAGING_URL}/transactions/${TX_DARNLEY}`);
  console.log("");
  console.log("  Open the Reminders tab on each. You should see:");
  console.log("    Tresco  — card 'X today · Next: ...' + drawer with sent today + 2 upcoming");
  console.log("    Jutland — chips visible on VM1 (grey) and PM1 (green) milestone rows");
  console.log("    Darnley — Upcoming section shows first-chase for 'Receive welcome pack'");
  console.log("");
  console.log("[spot-check] when you're done, undo with:");
  console.log("    npx tsx scripts/seed-staging-spot-check.ts --cleanup");
}

async function cleanup() {
  console.log("");
  console.log("[spot-check] === cleaning up ===");

  // Delete CCS rows for all three tx IDs
  const ccs = await prisma.clientChaseState.deleteMany({
    where: { transactionId: { in: ALL_TX_IDS } },
  });
  console.log(`[spot-check] deleted ${ccs.count} ClientChaseState rows`);

  // Delete OutboundEmailQueue rows tagged with our SEED_TAG
  const queue = await prisma.outboundEmailQueue.deleteMany({
    where: { sourceId: { startsWith: `${SEED_TAG}:` } },
  });
  console.log(`[spot-check] deleted ${queue.count} OutboundEmailQueue rows`);

  // Restore placeholder emails on contacts that were NULL before seeding.
  // We identify them by the deterministic format used by ensureContactEmail:
  // `seed-<contact-id-prefix>@spot-check.test`.
  const restoredEmails = await prisma.contact.updateMany({
    where: {
      propertyTransactionId: { in: ALL_TX_IDS },
      email: { endsWith: "@spot-check.test" },
    },
    data: { email: null },
  });
  console.log(`[spot-check] restored ${restoredEmails.count} placeholder emails to NULL`);

  // Restore Darnley's VM1 and VM3
  const vm1Def = await prisma.milestoneDefinition.findUnique({ where: { code: "VM1" }, select: { id: true } });
  const vm3Def = await prisma.milestoneDefinition.findUnique({ where: { code: "VM3" }, select: { id: true } });
  if (vm1Def) {
    await prisma.milestoneCompletion.updateMany({
      where: { transactionId: TX_DARNLEY, milestoneDefinitionId: vm1Def.id },
      data: { state: "available", completedAt: null },
    });
    console.log(`[spot-check] restored Darnley VM1 → state=available, completedAt=null`);
  }
  if (vm3Def) {
    // The seed upserted VM3 — it may not have existed before. Safe to
    // delete the row entirely; the state machine will recreate as "locked"
    // when next exercised.
    const del = await prisma.milestoneCompletion.deleteMany({
      where: { transactionId: TX_DARNLEY, milestoneDefinitionId: vm3Def.id },
    });
    console.log(`[spot-check] deleted Darnley VM3 row (${del.count} rows)`);
  }

  console.log("");
  console.log("[spot-check] cleanup complete");
}

async function main() {
  await preflight();
  if (process.argv.includes("--cleanup")) {
    await cleanup();
  } else {
    await seed();
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
