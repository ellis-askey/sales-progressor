// One-shot script: send a real client-chase digest to ellisaskey@googlemail.com
// for the staging walk. Bypasses EMAIL_SANDBOX_MODE for this single send by
// passing sandboxMode.enable=false explicitly to sgMail.
//
// Mixed-tone digest: one DIY item (PM3), one NUDGE-solicitor (PM7), one
// NUDGE-lender (PM6). Recipient is a purchaser-role Contact so the PM-side
// codes route correctly.
//
// SAFE BY DESIGN:
//   - Hardcoded recipient (ellisaskey@googlemail.com)
//   - Force-loads .env.local with override BEFORE importing prisma, so shell
//     env vars (which may point at prod) cannot win against the file-defined
//     staging DATABASE_URL
//   - Hard-aborts if the connected DB project ID matches production
//   - Creates an isolated fixture (one Agency, one Tx, one Contact)
//   - Fixture IDs logged loudly for manual cleanup after testing
//   - sandboxMode override is per-call only; no env mutation
//
// Run: npx tsx scripts/test-send-chase-email.ts

// CRITICAL: load .env.local BEFORE importing prisma. The prisma client
// initialises at import-time using whatever DATABASE_URL is in process.env
// at that moment. If a shell-level DATABASE_URL is set (which happened
// during the first run of this script and contaminated prod), it would win
// against tsx's automatic .env loading. Force-override here.
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

// Force the digest assembler to build links against the staging deployment,
// AFTER dotenv has loaded .env.local (which may have set NEXTAUTH_URL to
// localhost or production). This override is intentional and final.
process.env.NEXTAUTH_URL = "https://salesprogressor-git-staging-ellis-askeys-projects.vercel.app";

import sgMail from "@sendgrid/mail";
import { prisma } from "../lib/prisma";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";

// Production project ID per CLAUDE.md — hard abort if we ever connect here.
const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";

const RECIPIENT_EMAIL = "ellisaskey@googlemail.com";
const RECIPIENT_NAME = "Ellis Askey";
const RECIPIENT_ROLE = "purchaser" as const;

// Mixed-tone payload (one DIY + one NUDGE-solicitor + one NUDGE-lender)
const TEST_CODES = ["PM3", "PM6", "PM7"];

// Walks DIRECT_PREREQUISITES recursively to collect every upstream milestone
// code for a given target. Returns the codes IN ORDER from deepest to nearest
// (so seeding in iteration order satisfies each level's prereqs before its
// dependents). Excludes the target itself.
//
// Without this, the fixture script would only seed each milestone's reminder
// "anchor" (per ReminderRule), but completeMilestone enforces the separate
// DIRECT_PREREQUISITES map and would throw on confirm. Example: PM7's anchor
// is VM7 but its prerequisite is PM4 — seeding only VM7 leaves PM7 unable
// to be confirmed via the portal.
function collectAllPrereqs(code: string): string[] {
  const collected = new Set<string>();
  const stack = [...(DIRECT_PREREQUISITES[code] ?? [])];
  while (stack.length > 0) {
    const next = stack.pop()!;
    if (collected.has(next)) continue;
    collected.add(next);
    const upstream = DIRECT_PREREQUISITES[next] ?? [];
    for (const u of upstream) stack.push(u);
  }
  return Array.from(collected);
}

async function main() {
  // ─── Pre-flight: confirm we are NOT connected to production ──────────
  const dbUrl = process.env.DATABASE_URL || "";
  const projectMatch = dbUrl.match(/postgres\.([^:]+):/);
  const projectId = projectMatch ? projectMatch[1] : "unknown";
  console.log(`[test-send] DB project ID: ${projectId}`);
  if (projectId === PROD_PROJECT_ID) {
    console.error("");
    console.error(`[test-send] HARD ABORT: DATABASE_URL points at PRODUCTION (${PROD_PROJECT_ID})`);
    console.error(`[test-send] This script must only run against staging (${STAGING_PROJECT_ID}).`);
    console.error(`[test-send] Check .env.local has the staging URL and shell env DATABASE_URL is unset.`);
    process.exit(1);
  }
  if (projectId !== STAGING_PROJECT_ID) {
    console.error(`[test-send] WARN: connected to neither prod nor staging — connecting to "${projectId}"`);
    console.error(`[test-send] If this is intentional (e.g. local dev), comment out this guard.`);
    process.exit(1);
  }

  if (!process.env.SENDGRID_API_KEY) {
    console.error("[test-send] FATAL: SENDGRID_API_KEY not set in env");
    process.exit(1);
  }
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  console.log(`[test-send] NEXTAUTH_URL: ${process.env.NEXTAUTH_URL}`);
  console.log(`[test-send] recipient: ${RECIPIENT_EMAIL}`);
  console.log(`[test-send] mixed-tone digest with codes: ${TEST_CODES.join(", ")}`);
  console.log("");

  // ─── 1. Agency + agent (idempotent via TraceHarness pattern) ──────────
  let agency = await prisma.agency.findFirst({ where: { name: "TraceHarnessAgency" } });
  if (!agency) {
    agency = await prisma.agency.create({ data: { name: "TraceHarnessAgency", isInternal: true } });
  }
  let agent = await prisma.user.findFirst({ where: { email: "trace-agent@example.test" } });
  if (!agent) {
    agent = await prisma.user.create({
      data: {
        name: "Trace Agent",
        email: "trace-agent@example.test",
        role: "director",
        agencyId: agency.id,
        firmName: "TraceHarnessAgency",
      },
    });
  }

  // ─── 2. Fresh transaction ─────────────────────────────────────────────
  const transaction = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: `42 Walk-Through Lane, London, W1 1AA`,
      agencyId: agency.id,
      agentUserId: agent.id,
      assignedUserId: agent.id,
      purchaseType: "cash_buyer",
      tenure: "freehold",
      serviceType: "self_managed",
      progressedBy: "agent",
    },
  });
  console.log(`[test-send] created transaction: ${transaction.id} — "${transaction.propertyAddress}"`);

  // ─── 3. Recipient contact (purchaser role for PM-side routing) ────────
  const portalToken = `walkthrough-${Date.now()}`;
  const contact = await prisma.contact.create({
    data: {
      propertyTransactionId: transaction.id,
      name: RECIPIENT_NAME,
      email: RECIPIENT_EMAIL,
      roleType: RECIPIENT_ROLE,
      portalToken,
    },
  });
  console.log(`[test-send] created contact: ${contact.id} — token: ${portalToken}`);

  // ─── 4. Seed prerequisite chains (so the portal Confirm action passes
  //        the DIRECT_PREREQUISITES guard in completeMilestone). Walks the
  //        full chain for each test code, deduplicates, and seeds every
  //        upstream code as state="complete". This is the unified set
  //        across all TEST_CODES — not per-code, so the same milestone
  //        only gets one row.
  const prereqUnion = new Set<string>();
  for (const target of TEST_CODES) {
    for (const upstream of collectAllPrereqs(target)) {
      prereqUnion.add(upstream);
    }
  }
  const prereqList = Array.from(prereqUnion);

  for (const code of prereqList) {
    const def = await prisma.milestoneDefinition.findUnique({ where: { code }, select: { id: true } });
    if (!def) {
      console.warn(`[test-send] WARN: prereq milestone def not found: ${code}`);
      continue;
    }
    await prisma.milestoneCompletion.create({
      data: {
        transactionId: transaction.id,
        milestoneDefinitionId: def.id,
        state: "complete",
        completedAt: new Date(Date.now() - 7 * 86_400_000),
      },
    });
  }
  console.log(`[test-send] seeded ${prereqList.length} prereq completions: ${prereqList.join(", ")}`);

  // ─── 5. Seed target milestone completions (state="available") ────────
  const targetDefIds: Record<string, string> = {};
  for (const code of TEST_CODES) {
    const def = await prisma.milestoneDefinition.findUnique({ where: { code }, select: { id: true } });
    if (!def) {
      console.warn(`[test-send] WARN: target milestone def not found: ${code}`);
      continue;
    }
    targetDefIds[code] = def.id;
    await prisma.milestoneCompletion.create({
      data: {
        transactionId: transaction.id,
        milestoneDefinitionId: def.id,
        state: "available",
      },
    });
  }
  console.log(`[test-send] seeded ${TEST_CODES.length} target completions (state=available): ${TEST_CODES.join(", ")}`);

  // ─── 6. Seed ClientChaseState rows (so the respond page shows them) ──
  const now = new Date();
  for (const code of TEST_CODES) {
    await prisma.clientChaseState.create({
      data: {
        transactionId: transaction.id,
        contactId: contact.id,
        milestoneCode: code,
        chaseCount: 1,
        firstChasedAt: now,
        lastChasedAt: now,
        status: "active",
      },
    });
  }
  console.log(`[test-send] seeded ${TEST_CODES.length} ClientChaseState rows (status=active, chaseCount=1)`);

  // ─── 7. Build the digest payload via the real assembler ──────────────
  const { assembleDigestPayload } = await import("../lib/email/client-chase-digest");
  const payload = assembleDigestPayload({
    transaction: { id: transaction.id, propertyAddress: transaction.propertyAddress },
    contact: { id: contact.id, name: contact.name, portalToken: contact.portalToken! },
    milestones: TEST_CODES.map((code) => ({ code })),
  });

  console.log("");
  console.log(`[test-send] ─── digest payload ──────────────────────────────────`);
  console.log(`[test-send] subject:       ${payload.subject}`);
  console.log(`[test-send] respondUrl:    ${payload.respondUrl}`);
  console.log(`[test-send] unsubscribeUrl ${payload.unsubscribeUrl.slice(0, 80)}...`);
  console.log("");
  console.log(`[test-send] ─── text body (first 600 chars) ────────────────────`);
  console.log(payload.text.slice(0, 600));
  console.log("...");
  console.log("");

  // ─── 8. Send via SendGrid with sandbox forced OFF ─────────────────────
  const DEFAULT_FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";

  console.log(`[test-send] sending to ${RECIPIENT_EMAIL} via SendGrid (sandboxMode=false)...`);
  await sgMail.send({
    to: RECIPIENT_EMAIL,
    from: DEFAULT_FROM,
    replyTo: "support@thesalesprogressor.co.uk",
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    mailSettings: { sandboxMode: { enable: false } },
  });
  console.log(`[test-send] ✓ email sent`);
  console.log("");

  // ─── 9. Print cleanup info ────────────────────────────────────────────
  console.log(`[test-send] ─── FIXTURE IDS FOR CLEANUP ─────────────────────────`);
  console.log(`[test-send] transactionId: ${transaction.id}`);
  console.log(`[test-send] contactId:     ${contact.id}`);
  console.log(`[test-send] portalToken:   ${portalToken}`);
  console.log(`[test-send] respondUrl:    ${payload.respondUrl}`);
  console.log("");
  console.log(`[test-send] To delete the fixture after testing:`);
  console.log(`[test-send]   await prisma.propertyTransaction.delete({ where: { id: "${transaction.id}" } });`);
  console.log(`[test-send] (cascades to contact, completions, ClientChaseState rows)`);
  console.log("");
  console.log(`[test-send] If you want to KEEP the fixture and re-test the respond page:`);
  console.log(`[test-send]   open ${payload.respondUrl}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[test-send] FATAL:", err);
  await prisma.$disconnect();
  process.exit(1);
});
