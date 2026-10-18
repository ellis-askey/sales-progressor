// One-shot: seed the PRODUCTION demo agency "Boardwalk Property Co" for the
// research demo on Thu 2026-10-15 11:00. Director login millie@boardwalkpropertyco.com.
//
// SILENCE IS THE #1 REQUIREMENT. This seed sends ZERO email tonight or tomorrow:
//   - Millie (millie@boardwalkpropertyco.com) — the only real inbox on the account:
//       * welcomeEmailSentAt = now  -> blocks the register welcome + retention day-1
//       * retentionEmailOptOut = true -> blocks every retention-sweep tier
//       * agentPreferences.notifications.* all false -> blocks morning digest (08:30 UK)
//         + weekly brief + client-confirmation + chain + appointment emails
//   - The single client contact (file 4) uses ellisaskey+boardwalk@googlemail.com
//     (Ellis's own inbox, NOT a Boardwalk address) AND is paused:
//       * Contact.emailsPausedAt = now        -> client-chase cron (10:00 UK) skips it
//       * Tx.clientEmailsPaused / vendorEmailsPaused = true -> file-level belt+braces
//     No OutboundEmailQueue rows are created, so send-milestone-digests drains nothing.
//   - isDemo is NEVER set, so the 03:00 demo-cleanup cron (deletes only isDemo:true)
//     cannot remove these files.
//
// White-label:
//   - User.agentPreferences.brandColor = #404648 -> the agent app renders charcoal
//   - Agency.emailTheme = Boardwalk charcoal/stone -> client emails branded
//   - Agency.logoPath -> Boardwalk wordmark (charcoal, incl. B-Corp badge) uploaded
//     to the public agency-logos bucket; shows in client emails + portal
//
// Guard: REFUSES to run unless DATABASE_URL points at PROD (gmkfustgwipgihpmpjpr).
// Idempotent — re-running tops up (won't duplicate the agency, user, or files).
//
// Run (dry-run first):
//   npx dotenv -e .env.production --override -- npx tsx scripts/seed-boardwalk-demo.ts --dry-run
//   npx dotenv -e .env.production --override -- npx tsx scripts/seed-boardwalk-demo.ts
//
// Registered in docs/SCRIPTS_REGISTRY.md per Law 15.
// Lifetime: one-shot. DELETE this script + the seeded account after the demo.

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

const AGENCY_NAME = "Boardwalk Property Co";
const DIRECTOR_EMAIL = "millie@boardwalkpropertyco.com";
const DIRECTOR_NAME = "Millie McClure";
const DIRECTOR_PASSWORD = "password";

// Boardwalk's real brand, extracted from boardwalkpropertyco.com CSS.
const CHARCOAL = "#404648";
const STONE = "#f3f0ee";

// Charcoal wordmark PNG (includes the "Certified B Corporation" badge, per Ellis),
// rendered from their site SVG via sharp. Transparent background, 900x173.
const LOGO_PNG = "C:/Users/ellis/AppData/Local/Temp/claude/c--Users-ellis-Downloads-Sales-Prog-App-full/078c91c5-e2e9-4bc9-bb40-1c94985ff5ae/scratchpad/boardwalk-wordmark-charcoal.png";

const AGENCY_LOGOS_BUCKET = "agency-logos";

// Boardwalk charcoal/stone client-email theme. Keys are the ones resolveEmailTheme
// reads in lib/email/brand-theme.ts; any omitted key falls back to the SP default.
const EMAIL_THEME = {
  headerColor: CHARCOAL,      // hero band
  headerColor2: CHARCOAL,     // flat (no gradient)
  gradientDir: "to bottom",
  buttonColor: CHARCOAL,      // CTA button
  headerTextColor: STONE,     // text on the charcoal hero
  linkColor: CHARCOAL,        // links in body
  footerBg: STONE,
  footerText: CHARCOAL,
  accentColor: CHARCOAL,
};

// Agent-app notification opt-outs: every agent-facing automated email OFF for Millie.
const SILENT_NOTIFICATIONS = {
  morningDigest: false,
  weeklyBrief: false,
  clientConfirmationEmails: false,
  chainEmails: false,
  appointmentReminders: false,
};

// Use the DIRECT (non-pooled) connection — the pgbouncer pooler drops long
// multi-write seeds (P1017). DATABASE_URL is still what the guard checks.
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

const now = new Date();
function daysAgo(n: number) { return new Date(now.getTime() - n * 86400000); }
function daysAhead(n: number) { return new Date(now.getTime() + n * 86400000); }

// ── Sample Bristol pipeline (fictional addresses on real streets, fake clients) ──
type Stage = {
  address: string;
  createdDaysAgo: number;
  completions: number;
  includeExchange?: boolean;
  status?: "active" | "completed";
  completionDate?: Date | null;
  expectedExchangeDate?: Date | null;
  purchasePricePence: number;
  // file 4 only: a portalled client (Ellis's own inbox), fully paused
  portalClient?: { name: string; email: string } | null;
};

const STAGES: Stage[] = [
  { address: "14 North Street, Bedminster, Bristol, BS3 1HT", createdDaysAgo: 6, completions: 2, purchasePricePence: 32_5000_00 },
  { address: "52 Cotham Brow, Cotham, Bristol, BS6 6AR", createdDaysAgo: 24, completions: 8, purchasePricePence: 41_0000_00 },
  { address: "9 Ashton Road, Southville, Bristol, BS3 1QP", createdDaysAgo: 38, completions: 11, purchasePricePence: 36_5000_00 },
  { address: "27 Chandos Road, Redland, Bristol, BS6 6PF", createdDaysAgo: 61, completions: 17, expectedExchangeDate: daysAhead(4), purchasePricePence: 52_5000_00,
    portalClient: { name: "Sarah Whitfield", email: "ellisaskey+boardwalk@googlemail.com" } },
  { address: "18 Fernbank Road, Montpelier, Bristol, BS6 5JW", createdDaysAgo: 92, completions: 18, includeExchange: true, completionDate: daysAhead(12), purchasePricePence: 47_0000_00 },
  { address: "6 Hill Avenue, Totterdown, Bristol, BS4 3HN", createdDaysAgo: 140, completions: 20, includeExchange: true, status: "completed", completionDate: daysAgo(21), purchasePricePence: 38_5000_00 },
];

async function uploadLogo(agencyId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("  ! Supabase env missing — skipping logo upload"); return null; }
  const path = `${agencyId}.png`;
  if (DRY_RUN) { console.log(`  [dry-run] would upload ${LOGO_PNG} -> ${AGENCY_LOGOS_BUCKET}/${path}`); return path; }
  const buf = readFileSync(LOGO_PNG);
  const supabase = createClient(url, key);
  const { error } = await supabase.storage.from(AGENCY_LOGOS_BUCKET).upload(path, buf, {
    contentType: "image/png", upsert: true,
  });
  if (error) { console.error("  ! logo upload failed:", error.message); return null; }
  console.log(`  logo uploaded: ${AGENCY_LOGOS_BUCKET}/${path}`);
  return path;
}

async function verify() {
  console.log("== VERIFY (read-only) ==\n");
  const agency = await prisma.agency.findFirst({
    where: { name: AGENCY_NAME },
    select: { id: true, name: true, logoPath: true, logoTileColor: true, emailTheme: true,
      chaseEmailsEnabled: true, weeklyClientUpdatesEnabled: true },
  });
  console.log("AGENCY:", agency?.name, agency?.id);
  console.log("  logoPath:", agency?.logoPath);
  console.log("  logoTileColor:", agency?.logoTileColor, "| emailTheme.headerColor:", (agency?.emailTheme as any)?.headerColor);
  const pubUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AGENCY_LOGOS_BUCKET}/${agency?.logoPath}`;
  console.log("  logo public URL:", pubUrl);

  const user = await prisma.user.findUnique({
    where: { email: DIRECTOR_EMAIL },
    select: { id: true, name: true, role: true, agencyId: true, firmName: true, welcomeEmailSentAt: true,
      retentionEmailOptOut: true, deactivatedAt: true, hasSeenAgentWelcome: true, demoTourSkippedAt: true,
      agentPreferences: true, password: true },
  });
  const pwOk = user?.password ? await bcrypt.compare("password", user.password) : false;
  console.log("\nDIRECTOR:", user?.name, "|", user?.role, "| agencyMatch:", user?.agencyId === agency?.id);
  console.log("  firmName:", user?.firmName, "| deactivatedAt:", user?.deactivatedAt);
  console.log("  password 'password' accepted:", pwOk);
  console.log("  SILENCE -> welcomeEmailSentAt:", !!user?.welcomeEmailSentAt, "| retentionEmailOptOut:", user?.retentionEmailOptOut,
    "| notifications:", JSON.stringify((user?.agentPreferences as any)?.notifications));
  console.log("  brandColor:", (user?.agentPreferences as any)?.brandColor);

  const txs = await prisma.propertyTransaction.findMany({
    where: { agencyId: agency?.id },
    select: { id: true, propertyAddress: true, status: true, isDemo: true, clientEmailsPaused: true,
      expectedExchangeDate: true, completionDate: true,
      _count: { select: { milestoneCompletions: true, contacts: true } },
      contacts: { select: { name: true, email: true, roleType: true, portalToken: true, emailsPausedAt: true } } },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\nFILES (${txs.length}), any isDemo:`, txs.some((t) => t.isDemo));
  for (const t of txs) {
    console.log(`  ${t.propertyAddress}`);
    console.log(`    status=${t.status} completions=${t._count.milestoneCompletions} contacts=${t._count.contacts} isDemo=${t.isDemo} clientEmailsPaused=${t.clientEmailsPaused}`);
    for (const c of t.contacts)
      console.log(`    contact: ${c.name} <${c.email}> ${c.roleType} paused=${!!c.emailsPausedAt} token=${c.portalToken?.slice(0, 10)}…`);
  }

  // Any outbound email queued for this agency's users/files? (should be none)
  const queued = await prisma.outboundEmailQueue.count({
    where: { OR: [{ recipientEmail: DIRECTOR_EMAIL }, { recipientEmail: "ellisaskey+boardwalk@googlemail.com" }] },
  }).catch(() => -1);
  console.log("\nOUTBOUND EMAIL QUEUED to millie/portal-client:", queued, queued === 0 ? "(clean)" : queued === -1 ? "(table/field name differs — check manually)" : "(!!)" );
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  // HARD GUARD: this script is PROD-ONLY. Refuse anything that isn't prod.
  if (!dbUrl.includes("gmkfustgwipgihpmpjpr")) {
    console.error("REFUSING: DATABASE_URL does not point at the PRODUCTION project (gmkfustgwipgihpmpjpr).");
    console.error("Run with: npx dotenv -e .env.production --override -- npx tsx scripts/seed-boardwalk-demo.ts");
    process.exit(1);
  }
  if (dbUrl.includes("etidawkbqctarmsdjoxp")) {
    console.error("REFUSING: DATABASE_URL looks like STAGING.");
    process.exit(1);
  }
  if (process.argv.includes("--verify")) { await verify(); return; }
  console.log(`== Boardwalk prod seed ${DRY_RUN ? "(DRY RUN — no writes)" : "(LIVE WRITE TO PRODUCTION)"} ==`);
  console.log("Prod project confirmed: gmkfustgwipgihpmpjpr\n");

  // ── Agency ──────────────────────────────────────────────────────────
  let agency = await prisma.agency.findFirst({ where: { name: AGENCY_NAME }, select: { id: true } });
  if (!agency && !DRY_RUN) {
    agency = await prisma.agency.create({
      data: {
        name: AGENCY_NAME,
        feeTier: "standard",
        emailTheme: EMAIL_THEME,
        logoTileColor: STONE,  // charcoal wordmark sits on a stone band
        logoScale: "md",
        logoAlign: "left",
      },
      select: { id: true },
    });
  } else if (agency && !DRY_RUN) {
    agency = await prisma.agency.update({
      where: { id: agency.id },
      data: { emailTheme: EMAIL_THEME, logoTileColor: STONE, logoScale: "md", logoAlign: "left" },
      select: { id: true },
    });
  }
  const agencyId = agency?.id ?? "(dry-run-no-agency-id)";
  console.log(`Agency: ${AGENCY_NAME} (${agencyId})`);

  // ── Logo ────────────────────────────────────────────────────────────
  if (!DRY_RUN && agency) {
    const logoPath = await uploadLogo(agency.id);
    if (logoPath) await prisma.agency.update({ where: { id: agency.id }, data: { logoPath } });
  } else if (DRY_RUN) {
    await uploadLogo(agencyId);
  }

  // ── Director (Millie) ───────────────────────────────────────────────
  const password = await bcrypt.hash(DIRECTOR_PASSWORD, 12);
  const userData = {
    password,
    role: "director" as const,
    agencyId: agency?.id,
    name: DIRECTOR_NAME,
    firmName: AGENCY_NAME,
    hasSeenAgentWelcome: true,
    demoTourSkippedAt: now,
    // ── SILENCE ──
    welcomeEmailSentAt: now,
    retentionEmailOptOut: true,
    agentPreferences: { brandColor: CHARCOAL, notifications: SILENT_NOTIFICATIONS },
  };
  let userId = "(dry-run-no-user-id)";
  if (!DRY_RUN && agency) {
    const user = await prisma.user.upsert({
      where: { email: DIRECTOR_EMAIL },
      update: userData,
      create: { email: DIRECTOR_EMAIL, ...userData },
      select: { id: true },
    });
    userId = user.id;
  }
  console.log(`Director: ${DIRECTOR_EMAIL} / "${DIRECTOR_PASSWORD}" (${userId})`);
  console.log(`  silence: welcomeEmailSentAt set, retentionEmailOptOut=true, all notifications OFF`);

  // ── Milestone defs ──────────────────────────────────────────────────
  const allDefs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true, side: true, orderIndex: true },
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });
  const defsByCode = new Map(allDefs.map((d) => [d.code, d.id]));
  const vmDefs = allDefs.filter((d) => d.side === "vendor" && !["VM19", "VM20"].includes(d.code));
  const pmDefs = allDefs.filter((d) => d.side === "purchaser" && !["PM26", "PM27"].includes(d.code));
  const vm19 = defsByCode.get("VM19");
  if (!vm19 || vmDefs.length === 0 || pmDefs.length === 0) {
    console.error("Milestone def lookup failed. Aborting."); process.exit(1);
  }

  // ── Files ───────────────────────────────────────────────────────────
  console.log("\nFiles:");
  for (const s of STAGES) {
    const existing = await prisma.propertyTransaction.findFirst({
      where: { propertyAddress: s.address, agencyId: agency?.id },
      select: { id: true, _count: { select: { milestoneCompletions: true, contacts: true } } },
    });
    if (existing) {
      // Self-heal: a complete file is left alone; a partial one (interrupted by a
      // pooler drop) is deleted and rebuilt. "Complete" = enough completions and,
      // for the portalled file, a contact present.
      const target = s.completions + (s.includeExchange ? 1 : 0);
      const complete = existing._count.milestoneCompletions >= target &&
        (!s.portalClient || existing._count.contacts >= 1);
      if (complete) { console.log(`  skip (complete): ${s.address}`); continue; }
      if (DRY_RUN) { console.log(`  [dry-run] would REPAIR partial: ${s.address}`); continue; }
      await prisma.milestoneCompletion.deleteMany({ where: { transactionId: existing.id } });
      await prisma.contact.deleteMany({ where: { propertyTransactionId: existing.id } });
      await prisma.propertyTransaction.delete({ where: { id: existing.id } });
      console.log(`  repairing (was partial): ${s.address}`);
    }
    if (DRY_RUN) {
      console.log(`  [dry-run] ${s.address} — ${s.completions} completions${s.includeExchange ? " + exchange" : ""}${s.status === "completed" ? " + COMPLETED" : ""}${s.portalClient ? " + portal client (paused)" : ""}`);
      continue;
    }
    const tx = await prisma.propertyTransaction.create({
      data: {
        propertyAddress: s.address,
        agencyId: agency!.id,
        agentUserId: userId,
        status: s.status ?? "active",
        serviceType: "self_managed",
        purchasePrice: s.purchasePricePence,
        expectedExchangeDate: s.expectedExchangeDate ?? null,
        completionDate: s.completionDate ?? null,
        createdAt: daysAgo(s.createdDaysAgo),
        lastActivityAt: daysAgo(Math.max(0, s.createdDaysAgo - 4)),
        // belt + braces: file 4 (portal client) can never be client-chased
        clientEmailsPaused: s.portalClient ? true : false,
        vendorEmailsPaused: s.portalClient ? true : false,
        // isDemo intentionally left false/default — protects from demo-cleanup
      },
      select: { id: true },
    });
    // milestone completions, interleaved VM+PM by orderIndex up to the target
    const pool = [
      ...vmDefs.slice(0, Math.ceil(s.completions / 2)),
      ...pmDefs.slice(0, Math.floor(s.completions / 2)),
    ].slice(0, s.completions);
    for (const def of pool) {
      await prisma.milestoneCompletion.create({
        data: {
          transactionId: tx.id,
          milestoneDefinitionId: def.id,
          state: "complete",
          completedAt: daysAgo(Math.max(1, s.createdDaysAgo - 5 - Math.floor(Math.random() * 8))),
          completedById: userId,
        },
      });
    }
    if (s.includeExchange) {
      await prisma.milestoneCompletion.create({
        data: { transactionId: tx.id, milestoneDefinitionId: vm19, state: "complete",
          completedAt: daysAgo(Math.max(1, Math.floor(s.createdDaysAgo / 3))), completedById: userId },
      });
    }
    // Portal client on file 4 — Ellis's own inbox, chase PAUSED, portal openable.
    if (s.portalClient) {
      const token = randomBytes(24).toString("hex");
      await prisma.contact.create({
        data: {
          propertyTransactionId: tx.id,
          name: s.portalClient.name,
          email: s.portalClient.email,
          roleType: "vendor",
          portalEligible: true,
          portalToken: token,
          emailsPausedAt: now,  // client-chase cron skips a paused contact
        },
      });
      console.log(`  seeded: ${s.address} (${s.completions} completions, portal client PAUSED, token ${token.slice(0, 8)}…)`);
    } else {
      console.log(`  seeded: ${s.address} (${s.completions} completions${s.includeExchange ? " + exchange" : ""}${s.status === "completed" ? " + COMPLETED" : ""})`);
    }
  }

  console.log("\nDone.");
  if (!DRY_RUN) {
    console.log(`\nLOGIN:  ${DIRECTOR_EMAIL}  /  ${DIRECTOR_PASSWORD}`);
    console.log("Portal (file 4): /s/<token>  — token printed above / query Contact.portalToken");
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1);
});
