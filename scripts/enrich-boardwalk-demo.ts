// One-shot: FLESH OUT the Boardwalk Property Co prod demo files (run after
// seed-boardwalk-demo.ts). Adds, scaled to each file's stage:
//   - a property photo (Boardwalk's own Bristol listing exteriors) as the portal hero
//   - fake contacts (vendor + purchaser) — EVERY email is a +boardwalk variation of
//     ellisaskey@googlemail.com, EVERY contact chase-paused (emailsPausedAt)
//   - vendor/purchaser solicitors (+ a broker on mortgage files)
//   - a realistic activity thread (OutboundMessage, status "sent" = historical, NO send)
//   - varied milestone confirmers (agent / solicitor / client-via-portal) for a lifelike timeline
//   - a few checkpoints (some confirmed) and a few to-dos (ManualTask)
//
// SILENCE (same posture as the seed, extended for the new contacts):
//   - agency solicitorChaseEnabled / enquiryReplyChaseEnabled / enquiryRaiseChaseEnabled /
//     weeklyClientUpdatesEnabled -> false. chaseEmailsEnabled stays true BUT every client
//     contact has emailsPausedAt set, which the client-chase cron honours (skips them,
//     client-chase-cron.ts line 584/590). No OutboundEmailQueue rows are created and no
//     send function is called. Nothing is isDemo (survives demo-cleanup).
//   - All emails are ellisaskey+...@googlemail.com — Ellis's own inbox — so even a
//     misconfiguration could never reach a real Boardwalk/third-party address.
//
// Guard: PROD-ONLY (refuses non-prod DATABASE_URL). Connects via DIRECT_URL.
// Idempotent: photo + contacts + solicitor links + pauses are ensured every run;
// comms / checkpoints / to-dos are only added if the file has none yet.
//
// Run:
//   npx dotenv -e .env.production --override -- npx tsx scripts/enrich-boardwalk-demo.ts
//
// Registered in docs/SCRIPTS_REGISTRY.md (shares the seed-boardwalk-demo teardown).
// Lifetime: one-shot. Delete with the account after the demo.

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const PHOTO_DIR = "C:/Users/ellis/AppData/Local/Temp/claude/c--Users-ellis-Downloads-Sales-Prog-App-full/078c91c5-e2e9-4bc9-bb40-1c94985ff5ae/scratchpad/photos";
const DOCS_BUCKET = "transaction-documents";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });

const now = new Date();
function daysAgo(n: number) { return new Date(now.getTime() - n * 86400000); }

type Dir = "outbound" | "inbound" | "note";
type Method = "email" | "phone" | "whatsapp";
type Comm = { days: number; method: Method; dir: Dir; to: "buyer" | "seller" | "both"; subject?: string; content: string };
type Cp = { label: string; showTo: "none" | "vendor" | "purchaser" | "both"; daysOut?: number; confirmBy?: ("vendor" | "purchaser")[] };
type Todo = { title: string; notes?: string; daysDue?: number };

type Preset = {
  match: string;          // address substring to find the tx
  photo: string;          // filename in PHOTO_DIR
  ageDays: number;
  vendor: { name: string; emailTag: string; phone: string };
  purchaser?: { name: string; emailTag: string; phone: string };
  withSolicitors?: boolean;
  withBroker?: boolean;
  comms: Comm[];
  checkpoints?: Cp[];
  todos?: Todo[];
};

const EMAIL = (tag: string) => `ellisaskey+${tag}@googlemail.com`;

const PRESETS: Preset[] = [
  {
    match: "Bedminster", photo: "prop6.jpg", ageDays: 6,
    vendor: { name: "Greg Dawson", emailTag: "bw1v", phone: "07700 900011" },
    purchaser: { name: "Liam Docherty", emailTag: "bw1b", phone: "07700 900012" },
    withSolicitors: true,
    comms: [
      { days: 5, method: "email", dir: "outbound", to: "seller", subject: "Your sale is underway", content: "Hi Greg, we've started progressing the sale of your home. The first job is getting your solicitor instructed and the contract pack moving. We'll keep you posted at every step so you never have to chase us." },
      { days: 3, method: "phone", dir: "note", to: "both", content: "Called Greg to introduce ourselves and talk through the next few weeks. He's keen to move quickly, aiming for a pre-Christmas completion if the chain allows." },
    ],
    todos: [{ title: "Send Greg the solicitor instruction form", notes: "He asked us to recommend a local firm. Share the two we rate in BS3.", daysDue: 2 }],
  },
  {
    match: "Cotham Brow", photo: "prop2.jpg", ageDays: 24,
    vendor: { name: "Helen Fairfax", emailTag: "bw2v", phone: "07700 900022" },
    purchaser: { name: "Marcus Reed", emailTag: "bw2b", phone: "07700 900033" },
    withSolicitors: true,
    comms: [
      { days: 23, method: "email", dir: "outbound", to: "both", subject: "Solicitors instructed", content: "Both solicitors are now instructed and we've asked for the draft contract pack to be prepared. We'll let you know the moment it's issued to the buyer's side." },
      { days: 18, method: "phone", dir: "outbound", to: "seller", content: "Talked Helen through the property information forms. She's completing the TA6 and TA10 this week and will post them back to her solicitor." },
      { days: 12, method: "whatsapp", dir: "inbound", to: "seller", content: "Forms are done and in the post. Let me know if anything else is needed from me. Helen" },
      { days: 9, method: "email", dir: "outbound", to: "both", subject: "Enquiries stage", content: "The contract pack is with the buyer's solicitor and we expect their first set of enquiries shortly. This is a normal and important part of the process. We'll handle them and only come to you if we need a specific answer." },
      { days: 3, method: "phone", dir: "note", to: "both", content: "Buyer's solicitor confirmed searches are being ordered this week. Nothing outstanding from our side right now." },
    ],
    checkpoints: [{ label: "Return signed property information forms", showTo: "vendor", daysOut: -16, confirmBy: ["vendor"] }],
    todos: [{ title: "Chase buyer's solicitor for first enquiries", notes: "Contract pack issued 9 days ago. Give them a nudge if nothing lands by Friday.", daysDue: 2 }],
  },
  {
    match: "Southville", photo: "prop1.jpg", ageDays: 38,
    vendor: { name: "Priya Anand", emailTag: "bw3v", phone: "07700 900044" },
    purchaser: { name: "Tom Shaw", emailTag: "bw3b", phone: "07700 900055" },
    withSolicitors: true,
    comms: [
      { days: 36, method: "email", dir: "outbound", to: "both", subject: "Contract pack issued", content: "The draft contract pack has gone across to the buyer's solicitor. They'll review it and raise enquiries over the coming weeks. We'll keep both sides moving in parallel." },
      { days: 28, method: "email", dir: "inbound", to: "buyer", subject: "Re: searches", content: "Hi, my solicitor says the searches have been ordered and we should hear back in a few weeks. Is there anything I need to do in the meantime? Tom" },
      { days: 27, method: "email", dir: "outbound", to: "buyer", subject: "Re: searches", content: "Nothing needed from you right now Tom. While we wait for searches it's worth making sure your mortgage application is progressing and booking your own survey if you'd like one. We'll let you know as soon as the results are in." },
      { days: 18, method: "phone", dir: "note", to: "both", content: "Buyer's solicitor raised the first round of enquiries. Passed to Priya's solicitor. A couple will need Priya's input on the boundary and the boiler service history." },
      { days: 10, method: "whatsapp", dir: "outbound", to: "seller", content: "Hi Priya, two quick enquiries have come in. I'll call this afternoon to run through them, they're both straightforward." },
      { days: 4, method: "email", dir: "outbound", to: "both", subject: "Searches are back", content: "Good progress. The search results are back and nothing of concern has been flagged. The solicitors are working through the remaining enquiries now." },
    ],
    checkpoints: [
      { label: "Arrange access for the buyer's survey", showTo: "purchaser", daysOut: 5, confirmBy: ["purchaser"] },
      { label: "Confirm boiler service history with seller", showTo: "vendor", daysOut: -6, confirmBy: ["vendor"] },
    ],
    todos: [{ title: "Review search results with Priya's solicitor", notes: "All clear on the face of it. Confirm the drainage point before signing off.", daysDue: 1 }],
  },
  {
    match: "Chandos", photo: "prop7.jpg", ageDays: 61,
    vendor: { name: "Sarah Whitfield", emailTag: "boardwalk", phone: "07700 900123" },
    purchaser: { name: "Daniel Okafor", emailTag: "bw4b", phone: "07700 900456" },
    withSolicitors: true, withBroker: true,
    comms: [
      { days: 58, method: "email", dir: "outbound", to: "both", subject: "Your sale is underway", content: "Hi Sarah, we've started progressing the sale of 27 Chandos Road. Both solicitors will be instructed this week. We'll keep you updated at every step." },
      { days: 50, method: "email", dir: "outbound", to: "both", subject: "Contract pack issued", content: "The contract pack is with the buyer's solicitor. Enquiries will follow over the next couple of weeks. Nothing needed from you yet." },
      { days: 41, method: "email", dir: "inbound", to: "buyer", subject: "Re: mortgage", content: "Morning, the valuation went through fine and my mortgage offer came in today. I've forwarded it to my solicitor. Daniel" },
      { days: 40, method: "email", dir: "outbound", to: "buyer", subject: "Mortgage offer received", content: "Great news Daniel, we've logged your mortgage offer and confirmed it's landed with both solicitors. One more box ticked." },
      { days: 31, method: "phone", dir: "note", to: "both", content: "Chased the buyer's solicitor for the final enquiries. Two outstanding, both expected back this week." },
      { days: 22, method: "whatsapp", dir: "inbound", to: "seller", content: "Thank you for keeping us in the loop, it's so much less stressful this way. Sarah" },
      { days: 14, method: "email", dir: "outbound", to: "both", subject: "All enquiries satisfied", content: "All the legal enquiries have now been answered to the solicitors' satisfaction. The next step is the final report and signing the contract, then we can line up exchange." },
      { days: 6, method: "phone", dir: "outbound", to: "both", content: "Both sides have signed and returned their contracts. Deposit is with the buyer's solicitor. We're ready to agree an exchange date." },
      { days: 2, method: "email", dir: "outbound", to: "both", subject: "Ready to exchange", content: "Both solicitors have confirmed they're ready to exchange. We're coordinating a date now and will call you both before anything is agreed." },
    ],
    checkpoints: [
      { label: "Confirm preferred completion date", showTo: "both", daysOut: 4, confirmBy: ["vendor", "purchaser"] },
      { label: "Arrange access for final inspection", showTo: "vendor", daysOut: 7 },
    ],
    todos: [{ title: "Agree exchange date with both sides", notes: "Sarah asked to avoid the last week of the month. Call once both solicitors confirm the file is ready.", daysDue: 2 }],
  },
  {
    match: "Montpelier", photo: "prop4.jpg", ageDays: 92,
    vendor: { name: "Ruth Collingwood", emailTag: "bw5v", phone: "07700 900066" },
    purchaser: { name: "James Pearce", emailTag: "bw5b", phone: "07700 900077" },
    withSolicitors: true, withBroker: true,
    comms: [
      { days: 88, method: "email", dir: "outbound", to: "both", subject: "Your sale is underway", content: "Hi Ruth, we've started progressing the sale. Solicitors are being instructed and we'll keep both sides updated throughout." },
      { days: 70, method: "email", dir: "outbound", to: "both", subject: "Enquiries underway", content: "The contract pack is with the buyer's solicitor and enquiries are in progress. This is going smoothly so far." },
      { days: 48, method: "phone", dir: "note", to: "both", content: "All enquiries resolved. Both sides happy. Moving towards exchange." },
      { days: 30, method: "email", dir: "outbound", to: "both", subject: "Contracts signed", content: "Both contracts are signed and returned, and the deposit is in place. We're agreeing an exchange date now." },
      { days: 18, method: "email", dir: "outbound", to: "both", subject: "Exchanged, your sale is legally committed", content: "Contracts have exchanged. The sale is now legally binding and the completion date is fixed. Between now and completion we'll make sure everything is in place for the day." },
      { days: 10, method: "whatsapp", dir: "inbound", to: "seller", content: "Brilliant news, thank you so much for everything. Counting down to moving day now. Ruth" },
      { days: 3, method: "phone", dir: "note", to: "both", content: "Confirmed completion-day logistics with both solicitors. Funds flow and key release all lined up." },
    ],
    checkpoints: [
      { label: "Confirm key handover arrangement", showTo: "both", daysOut: 9, confirmBy: ["vendor", "purchaser"] },
      { label: "Take final meter readings on completion day", showTo: "both", daysOut: 9 },
    ],
    todos: [{ title: "Arrange completion-day key handover", notes: "Keys to the Boardwalk office by 9am on completion day for the buyer to collect once funds clear.", daysDue: 7 }],
  },
  {
    match: "Totterdown", photo: "prop3.jpg", ageDays: 140,
    vendor: { name: "Oliver Grant", emailTag: "bw6v", phone: "07700 900088" },
    purchaser: { name: "Nadia Hussain", emailTag: "bw6b", phone: "07700 900099" },
    withSolicitors: true,
    comms: [
      { days: 135, method: "email", dir: "outbound", to: "both", subject: "Your sale is underway", content: "Hi Oliver, we've started progressing the sale. We'll keep you updated at every step from here to completion." },
      { days: 100, method: "phone", dir: "note", to: "both", content: "Enquiries all resolved early, a very clean file. Both sides engaged and responsive throughout." },
      { days: 70, method: "email", dir: "outbound", to: "both", subject: "Exchanged", content: "Contracts have exchanged and completion is set. We'll be in touch with the final arrangements closer to the day." },
      { days: 45, method: "email", dir: "outbound", to: "both", subject: "Completion day, congratulations", content: "Completion has gone through. The funds have transferred and the keys are released. Congratulations Oliver, and thank you for letting us look after the sale." },
      { days: 44, method: "whatsapp", dir: "inbound", to: "seller", content: "Thank you, the whole thing was far smoother than our last move. We'd recommend you to anyone. Oliver" },
    ],
    checkpoints: [{ label: "Take final meter readings on completion day", showTo: "both", daysOut: -45, confirmBy: ["vendor", "purchaser"] }],
  },
];

async function uploadPhoto(txId: string, file: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const path = `property-photos/${txId}.jpg`;
  const buf = readFileSync(`${PHOTO_DIR}/${file}`);
  const supabase = createClient(url, key);
  const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, buf, { contentType: "image/jpeg", upsert: true });
  if (error) { console.error("  ! photo upload failed:", error.message); return null; }
  return path;
}

async function ensureFirm(name: string) {
  return prisma.solicitorFirm.upsert({ where: { name }, update: {}, create: { name }, select: { id: true } });
}
async function ensureSolContact(firmId: string, name: string, email: string, phone: string) {
  const found = await prisma.solicitorContact.findFirst({ where: { firmId, name }, select: { id: true } });
  if (found) return found;
  return prisma.solicitorContact.create({ data: { firmId, name, email, phone }, select: { id: true } });
}

async function ensureClientContact(txId: string, roleType: "vendor" | "purchaser", name: string, email: string, phone: string) {
  const existing = await prisma.contact.findFirst({ where: { propertyTransactionId: txId, roleType }, select: { id: true } });
  if (existing) {
    await prisma.contact.update({ where: { id: existing.id }, data: { name, email, phone, portalEligible: true, emailsPausedAt: now } });
    return existing.id;
  }
  const c = await prisma.contact.create({
    data: { propertyTransactionId: txId, roleType, name, email, phone, portalEligible: true, portalToken: randomBytes(24).toString("hex"), emailsPausedAt: now },
    select: { id: true },
  });
  return c.id;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.includes("gmkfustgwipgihpmpjpr")) { console.error("REFUSING: not the PROD project."); process.exit(1); }
  if (dbUrl.includes("etidawkbqctarmsdjoxp")) { console.error("REFUSING: looks like staging."); process.exit(1); }
  console.log("== Enrich Boardwalk demo (LIVE PROD) ==\n");

  const agency = await prisma.agency.findFirst({ where: { name: "Boardwalk Property Co" }, select: { id: true } });
  const user = await prisma.user.findUnique({ where: { email: "millie@boardwalkpropertyco.com" }, select: { id: true } });
  if (!agency || !user) { console.error("agency/user missing — run seed-boardwalk-demo.ts first."); process.exit(1); }

  // Silence: switch off the chase streams that now have solicitor/enquiry targets.
  await prisma.agency.update({
    where: { id: agency.id },
    data: { solicitorChaseEnabled: false, enquiryReplyChaseEnabled: false, enquiryRaiseChaseEnabled: false, weeklyClientUpdatesEnabled: false },
  });
  console.log("agency chase streams (solicitor/enquiry/weekly) -> OFF\n");

  // Shared solicitor firms + a broker (fictional Bristol).
  const vFirm = await ensureFirm("Clifton & Vale Conveyancing");
  const pFirm = await ensureFirm("Ashton Gate Legal LLP");
  const vSol = await ensureSolContact(vFirm.id, "Fiona Hart", EMAIL("bwsolv"), "0117 900 0100");
  const pSol = await ensureSolContact(pFirm.id, "David Mensah", EMAIL("bwsolb"), "0117 900 0200");

  for (const p of PRESETS) {
    const tx = await prisma.propertyTransaction.findFirst({
      where: { agencyId: agency.id, propertyAddress: { contains: p.match } },
      select: { id: true, propertyAddress: true, _count: { select: { communications: true } } },
    });
    if (!tx) { console.log(`  ! no file matching "${p.match}" — skipped`); continue; }
    console.log(`• ${tx.propertyAddress}`);

    // Photo (always ensure / upsert)
    const photoPath = await uploadPhoto(tx.id, p.photo);
    if (photoPath) await prisma.propertyTransaction.update({ where: { id: tx.id }, data: { photoStoragePath: photoPath, photoUploadedAt: now } });
    console.log(`    photo: ${photoPath ? "set" : "FAILED"}`);

    // Contacts (ensure + pause). Reset any file-level pause so no file shows a "paused" banner.
    const vendorId = await ensureClientContact(tx.id, "vendor", p.vendor.name, EMAIL(p.vendor.emailTag), p.vendor.phone);
    let purchaserId: string | null = null;
    if (p.purchaser) purchaserId = await ensureClientContact(tx.id, "purchaser", p.purchaser.name, EMAIL(p.purchaser.emailTag), p.purchaser.phone);
    await prisma.propertyTransaction.update({ where: { id: tx.id }, data: { clientEmailsPaused: false, vendorEmailsPaused: false, purchaserEmailsPaused: false } });

    // Solicitors
    if (p.withSolicitors) {
      await prisma.propertyTransaction.update({
        where: { id: tx.id },
        data: { vendorSolicitorFirmId: vFirm.id, vendorSolicitorContactId: vSol.id, purchaserSolicitorFirmId: pFirm.id, purchaserSolicitorContactId: pSol.id },
      });
    }
    console.log(`    contacts: vendor${purchaserId ? " + purchaser" : ""}${p.withSolicitors ? " + solicitors" : ""} (all paused)`);

    // (Milestone confirmer variation is owned by fix-boardwalk-milestones.ts,
    // which sets each file's true stage + varied confirmers. Not done here, so a
    // re-run of this enrichment never clobbers the staged milestone data.)

    // Comms / checkpoints / to-dos — only if this file has none yet (idempotent).
    if (tx._count.communications > 0) { console.log("    activity already present — skipping comms/checkpoints/todos"); continue; }

    for (const c of p.comms) {
      const recips = c.to === "buyer" ? (purchaserId ? [purchaserId] : []) : c.to === "seller" ? [vendorId] : [purchaserId, vendorId].filter(Boolean) as string[];
      const type = c.dir === "note" ? "internal_note" : c.dir === "inbound" ? "inbound" : "outbound";
      const senderName = c.to === "seller" ? p.vendor.name : (p.purchaser?.name ?? p.vendor.name);
      await prisma.outboundMessage.create({
        data: {
          transactionId: tx.id, agencyId: agency.id, type: type as any, method: c.method as any,
          channel: (c.method === "email" ? "email" : c.method === "whatsapp" ? "whatsapp" : "other") as any, purpose: "chase" as any, status: "sent" as any,
          subject: c.subject, content: c.content, contactIds: c.dir === "note" ? [] : recips,
          createdById: c.dir === "inbound" ? null : user.id, createdByRole: c.dir === "inbound" ? null : ("director" as any),
          senderLabel: c.dir === "inbound" ? senderName : null, visibleToClient: c.dir === "outbound",
          createdAt: daysAgo(c.days), updatedAt: daysAgo(c.days), sentAt: daysAgo(c.days),
        },
      });
    }
    console.log(`    comms: ${p.comms.length}`);

    for (const cp of p.checkpoints ?? []) {
      const row = await prisma.checkpoint.create({
        data: { transactionId: tx.id, label: cp.label, showTo: cp.showTo as any, targetDate: cp.daysOut != null ? daysAgo(-cp.daysOut) : null, createdById: user.id },
        select: { id: true },
      });
      for (const party of cp.confirmBy ?? []) {
        const cid = party === "vendor" ? vendorId : purchaserId;
        if (!cid) continue;
        await prisma.checkpointConfirmation.create({
          data: { checkpointId: row.id, party: party as any, confirmedByContactId: cid, confirmedByName: party === "vendor" ? p.vendor.name : (p.purchaser?.name ?? ""), eventDate: daysAgo(2) },
        }).catch(() => {});
      }
    }
    if (p.checkpoints?.length) console.log(`    checkpoints: ${p.checkpoints.length}`);

    for (const t of p.todos ?? []) {
      await prisma.manualTask.create({
        data: { agencyId: agency.id, transactionId: tx.id, title: t.title, notes: t.notes, status: "open" as any, isAgentRequest: false, createdById: user.id, dueDate: t.daysDue != null ? daysAgo(-t.daysDue) : null },
      });
    }
    if (p.todos?.length) console.log(`    to-dos: ${p.todos.length}`);
  }

  console.log("\nDone.");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
