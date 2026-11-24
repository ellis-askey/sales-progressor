// ONE-OFF: import Boardwalk Property Co's completed migration sheet, exactly as the
// Migrate Sale page would (silent: clientEmailsPaused + migratedAt, no client
// emails/chases/invites). Uses the REAL migrate services so results are identical
// to the page. Idempotent per address (migrationIdempotencyKey) so re-runs never
// duplicate. Chains are linked in a separate pass (--chains).
//
// SCRIPTS_REGISTRY: one-shot, author Claude/Ellis 2026-11-04. Delete after the
// Boardwalk book is imported and verified (ticket: Boardwalk go-live).
//
// Run (prod), canary one sale then the rest:
//   dotenv -e .env.production --override -- ts-node --transpile-only \
//     -r tsconfig-paths/register scripts/import-boardwalk-migration.ts --write --limit 1
//   (then without --limit for the rest, then --chains)
//
// Flags: --write (actually write; default is dry), --limit N (first N rows),
//        --only "<addr first line>" (one specific row), --chains (link pairs only).

import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import type { ContactRole, PurchaseType, Tenure } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createTransaction } from "@/lib/services/transactions";
import { initializeMilestoneCompletions } from "@/lib/services/milestones";
import { applyMigratedMilestoneCompletions } from "@/lib/services/migrate-milestones";
import { createChainV2, selfLinkOwnSale } from "@/lib/services/chains";
import { normaliseAddressString } from "@/lib/utils/address";

// Confirmed buyer<->seller pairs: `above` = the onward PURCHASE, `below` = the SALE.
const CHAIN_PAIRS: { above: string; below: string; person: string }[] = [
  { above: "2 Antons Corner", below: "3 Shepton Walk", person: "Nur Leaton" },
  { above: "7 Glendale", below: "33 Overndale Road", person: "Heulwyn Ellison" },
  { above: "9b First Avenue", below: "Flat 25 Captains House", person: "Christopher Tombe" },
  { above: "6 Everest Avenue", below: "25 New Buildings", person: "Christopher McCrickard" },
  { above: "Lower Maisonette", below: "Flat 2 Old Shoe Factory", person: "Stewart Mitchell" },
  { above: "10 Ventnor Road", below: "15 Edward Street", person: "Fabian Barker" },
];

const CSV_PATH = "C:/Users/ellis/Downloads/Sale_Migration_For_Agents_COMPLETED (2)(Sales).csv";
const TODAY = new Date("2026-11-04T00:00:00Z");
const PROD_PROJECT = "gmkfustgwipgihpmpjpr";
const HOLD: string[] = []; // 71 Muller + 5 Redcliffe now have method+owner (below)
// Founder-supplied method + owner for the two sheet rows that were left blank.
const METHOD_FIX: Record<string, string> = { "71 Muller Road": "Mortgage", "5 Redcliffe Lofts": "Mortgage" };
const OWNER_FIX: Record<string, string> = { "71 Muller Road": "laura@boardwalkpropertyco.com", "5 Redcliffe Lofts": "laura@boardwalkpropertyco.com" };

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const CHAINS_ONLY = args.includes("--chains");
const LIMIT = (() => { const i = args.indexOf("--limit"); return i >= 0 ? parseInt(args[i + 1], 10) : Infinity; })();
const ONLY = (() => { const i = args.indexOf("--only"); return i >= 0 ? args[i + 1].toLowerCase() : null; })();

// ---- founder-confirmed corrections ----
const DATE_FIX: Record<string, string> = {
  "2 Hedwick Avenue|VM2": "2026-10-19", "33 Overndale Road|PM11": "2026-10-07",
  "9b First Avenue|VM3": "2026-10-14", "9b First Avenue|VM4": "2026-10-14",
  "9b First Avenue|VM5": "2026-10-14", "9b First Avenue|VM6": "2026-10-14",
  "15 Edward Street|PM7": "2026-10-12", "30 Brecknock Road|PM10": "2026-10-28",
  "3 Shepton Walk|PM10": "2026-10-20", "16 Clovelly Road|VM6": "2026-10-08",
};
const DROP = new Set(["60 Sydenham Road|PM9", "40 Sion Road|PM10", "727 Bishport Avenue|PM10", "727 Bishport Avenue|PM13", "727 Bishport Avenue|PM14"]);
const MANAGED_FREEHOLD = new Set(["30 Mallard Close"]);
const SOLICITOR_FIX: Record<string, { vendor?: SolRaw; purchaser?: SolRaw }> = {
  "50 Hill Street": { purchaser: { firm: "Taylor Rose", handler: "Ikram Islam", phone: "02035518317", email: null, asst: null } },
  "21 Dean Lane": { vendor: { firm: "Taylor Rose", handler: "Shairah Panjwani", email: "Shairah.Panjwani1@taylor-rose.co.uk", phone: "02035409916", asst: null } },
};
type SolRaw = { firm: string; handler: string; phone: string | null; email: string | null; asst: string | null };

// ---- CSV + cleaners (same rules proven in the dry-run) ----
function parseCSV(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = "", i = 0, inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; } field += c; i++; continue; }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const clean = (s?: string) => (s ?? "").replace(/�/g, "").replace(/\s+/g, " ").trim();
function cleanPhone(raw?: string): string | null {
  let s = clean(raw); if (!s || /^n\/?a$/i.test(s)) return null;
  if (s.startsWith("+")) return s.replace(/[^\d+]/g, "");
  const d = s.replace(/[^\d]/g, ""); if (!d) return null;
  return d.length === 10 && !d.startsWith("0") ? "0" + d : d;
}
function cleanPrice(raw?: string): number | null {
  // purchasePrice is stored in PENCE, so the sheet's pounds value is ×100.
  const s = clean(raw).replace(/[",£\s]/g, ""); if (!s) return null;
  const n = parseInt(s, 10); return Number.isFinite(n) ? n * 100 : null;
}
function stripTitle(name?: string) { return clean(name).replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, ""); }
function parseDate(raw?: string): { iso: string; future: boolean } | null {
  const s = clean(raw); if (!s || /^n\/?a$/i.test(s)) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (!m) return null;
  let dd = +m[1], mm = +m[2], yy = +m[3]; if (yy < 100) yy += 2000;
  if (yy < 2000 || yy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const date = new Date(Date.UTC(yy, mm - 1, dd));
  return { iso: date.toISOString().slice(0, 10), future: date > TODAY };
}
function fmtUK(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
const BOOKING = new Set(["PM6", "PM9"]);
const V: Record<string, string> = { "solicitor instructed": "VM1", "memorandum of sale received": "VM2", "welcome pack received from solicitor": "VM3", "id & aml checks completed": "VM4", "property information forms received": "VM5", "property information forms returned": "VM6", "draft contract pack issued": "VM7", "management pack requested": "VM8", "management pack received": "VM9", "initial enquiries received": "VM10", "all enquiries satisfied": "VM15", "contract issued to seller to sign": "VM16", "signed contract returned": "VM17", "ready to exchange": "VM18", "contracts exchanged": "VM19", "sale completed": "VM20" };
const P: Record<string, string> = { "solicitor instructed": "PM1", "memorandum of sale received": "PM2", "id & aml checks completed": "PM3", "money on account paid": "PM4", "mortgage application submitted": "PM5", "lender valuation booked": "PM6", "mortgage offer received": "PM11", "private survey booked": "PM9", "survey report received": "PM10", "draft contract pack received": "PM7", "searches ordered": "PM8", "management pack received": "PM12", "search results received": "PM13", "enquiries raised": "PM14", "all enquiries satisfied": "PM20", "final report received from solicitor": "PM21", "contract issued to buyer to sign": "PM22", "signed contract returned": "PM23", "deposit transferred": "PM24", "ready to exchange": "PM25", "contracts exchanged": "PM26", "sale completed": "PM27" };
function tenureMap(t?: string): { tenure: Tenure | null; sof: boolean } {
  const x = clean(t).toLowerCase();
  if (x === "freehold") return { tenure: "freehold", sof: false };
  if (x === "leasehold") return { tenure: "leasehold", sof: false };
  if (x === "share of freehold") return { tenure: "leasehold", sof: true };
  return { tenure: null, sof: false };
}
function methodMap(m?: string): PurchaseType | null {
  const x = clean(m).toLowerCase();
  if (x === "mortgage") return "mortgage";
  if (x === "cash buyer") return "cash_buyer";
  if (x === "cash from sale proceeds") return "cash_from_proceeds";
  return null;
}
function normPerson(name?: string): string | null {
  const t = stripTitle(name).toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  return t.length < 2 ? null : `${t[0]} ${t[t.length - 1]}`;
}

type Plan = {
  addr1: string; address: string; agreedIso: string; ownerEmail: string; tenure: Tenure; sof: boolean;
  managed: boolean; method: PurchaseType; price: number | null;
  contacts: { name: string; companyName?: string; phone: string | null; email: string | null; roleType: ContactRole }[];
  sol: { vendor: SolRaw | null; purchaser: SolRaw | null };
  completions: { code: string; iso: string }[]; sticky: string[]; sellerName: string; buyerName: string;
};

function buildPlans(): Plan[] {
  const rows = parseCSV(readFileSync(CSV_PATH, "utf8"));
  const hIdx = rows.findIndex((r) => clean(r[0]).startsWith("First line of address"));
  const fieldH = rows[hIdx], subH = rows[hIdx + 1], sectionH = rows[hIdx - 1];
  let buyerStart = Infinity;
  sectionH.forEach((c, i) => { if (/BUYER'S SIDE/i.test(c)) buyerStart = Math.min(buyerStart, i); });
  const groups: { doneCol: number; dateCols: number[]; side: "V" | "P"; code?: string }[] = [];
  let lastName = "";
  for (let c = 27; c < subH.length; c++) {
    if (clean(fieldH[c])) lastName = clean(fieldH[c]).replace(/\s*\(.*$/s, "").trim();
    if (/^done\??$/i.test(clean(subH[c]))) {
      const dateCols: number[] = []; let k = c + 1;
      while (k < subH.length && !/^done\??$/i.test(clean(subH[k]))) { dateCols.push(k); k++; }
      const side = c >= buyerStart ? "P" : "V";
      groups.push({ doneCol: c, dateCols, side, code: (side === "P" ? P : V)[lastName.toLowerCase()] });
    }
  }
  const plans: Plan[] = [];
  for (const r of rows.slice(hIdx + 2)) {
    const addr1 = clean(r[0]); if (!addr1 || addr1.toLowerCase().includes("juniper way")) continue;
    if (HOLD.some((h) => addr1.toLowerCase().startsWith(h))) continue;
    const { tenure, sof } = tenureMap(r[3]); const method = methodMap(clean(r[4]) || METHOD_FIX[addr1] || "");
    if (!tenure || !method) throw new Error(`Row ${addr1}: tenure/method unmapped`);
    const managed = MANAGED_FREEHOLD.has(addr1);
    const contacts: Plan["contacts"] = [];
    const addC = (name?: string, email?: string, phone?: string, roleType: ContactRole = "vendor") => {
      const nm = clean(name); if (!nm) return;
      const isCo = /\b(ltd|limited|developments|homes|group)\b/i.test(nm);
      contacts.push({ name: isCo ? nm : stripTitle(nm), companyName: isCo ? nm : undefined, phone: cleanPhone(phone), email: clean(email) || null, roleType });
    };
    addC(r[9], r[10], r[11], "vendor"); addC(r[12], "", "", "vendor");
    addC(r[13], r[14], r[15], "purchaser"); addC(r[16], "", "", "purchaser");
    const mkSol = (firm?: string, handler?: string, phone?: string, email?: string, asst?: string): SolRaw | null => {
      const f = clean(firm); if (!f) return null;
      const a = clean(asst); return { firm: f, handler: clean(handler), phone: cleanPhone(phone), email: clean(email) || null, asst: a && !/^n\/?a$/i.test(a) ? a : null };
    };
    const sol = { vendor: mkSol(r[17], r[18], r[19], r[20], r[21]), purchaser: mkSol(r[22], r[23], r[24], r[25], r[26]) };
    const sfix = SOLICITOR_FIX[addr1];
    if (sfix?.vendor) sol.vendor = sfix.vendor;
    if (sfix?.purchaser) sol.purchaser = sfix.purchaser;
    const completions: Plan["completions"] = []; const sticky: string[] = [];
    for (const g of groups) {
      if (!g.code) continue; const key = `${addr1}|${g.code}`;
      if (DROP.has(key)) continue;
      if (DATE_FIX[key]) { completions.push({ code: g.code, iso: DATE_FIX[key] }); continue; }
      const done = clean(r[g.doneCol]).toLowerCase();
      let dateCell = ""; for (const dc of g.dateCols) { if (clean(r[dc])) { dateCell = r[dc]; break; } }
      if (done === "no" && !clean(dateCell)) continue;
      if (done !== "yes" && !clean(dateCell)) continue;
      const pd = parseDate(dateCell);
      if (clean(dateCell) && !pd) { throw new Error(`Row ${addr1}: ${g.code} unparseable date "${clean(dateCell)}" (should have been corrected)`); }
      if (pd?.future) {
        if (BOOKING.has(g.code)) completions.push({ code: g.code, iso: pd.iso });
        else sticky.push(`${capFirst(g.side === "P" ? invCode(P, g.code) : invCode(V, g.code))}: ${fmtUK(pd.iso)}`);
        continue;
      }
      if (!pd) throw new Error(`Row ${addr1}: ${g.code} ticked Yes but no date (should have been corrected/dropped)`);
      completions.push({ code: g.code, iso: pd.iso });
    }
    plans.push({
      addr1, address: `${addr1}, ${clean(r[1])}, ${clean(r[2])}`.replace(/, ,/g, ","),
      agreedIso: parseDate(r[6])?.iso ?? TODAY.toISOString().slice(0, 10),
      ownerEmail: (clean(r[7]) || OWNER_FIX[addr1] || "").toLowerCase(), tenure, sof, managed, method, price: cleanPrice(r[5]),
      contacts, sol, completions, sticky, sellerName: clean(r[9]), buyerName: clean(r[13]),
    });
  }
  return plans;
}
function capFirst(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function invCode(map: Record<string, string>, code: string) { return Object.keys(map).find((k) => map[k] === code) ?? code; }

async function findOrCreateSolicitor(s: SolRaw): Promise<{ firmId: string; contactId: string | null }> {
  let firm = await prisma.solicitorFirm.findFirst({ where: { name: s.firm } });
  if (!firm) firm = await prisma.solicitorFirm.create({ data: { name: s.firm } });
  let contactId: string | null = null;
  if (s.handler) {
    const existing = await prisma.solicitorContact.findFirst({ where: { firmId: firm.id, name: s.handler } });
    const c = existing ?? await prisma.solicitorContact.create({
      data: { firmId: firm.id, name: s.handler, phone: s.phone, email: s.email, secondaryEmail: s.asst },
    });
    contactId = c.id;
  }
  return { firmId: firm.id, contactId };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const isProd = dbUrl.includes(PROD_PROJECT);
  console.log(`DB: ${isProd ? "PRODUCTION" : "non-prod"} | mode: ${WRITE ? "WRITE" : "DRY"} | limit: ${LIMIT} | only: ${ONLY ?? "-"}`);
  if (WRITE && isProd && !args.includes("--yes-prod")) throw new Error("Refusing to WRITE to PROD without --yes-prod");

  // resolve owners + milestone defs
  const users = await prisma.user.findMany({ where: { email: { endsWith: "@boardwalkpropertyco.com" } }, select: { id: true, email: true, agencyId: true, role: true } });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const agencyId = users.find((u) => u.role === "director")?.agencyId ?? users[0]?.agencyId;
  if (!agencyId) throw new Error("Boardwalk agency not found");
  const defs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } });
  const defIdByCode = new Map(defs.map((d) => [d.code, d.id]));

  if (CHAINS_ONLY) { await linkChains(buildPlans(), agencyId); return; }

  let plans = buildPlans();
  if (ONLY) plans = plans.filter((p) => p.addr1.toLowerCase().startsWith(ONLY));
  plans = plans.slice(0, LIMIT);
  console.log(`\nProcessing ${plans.length} sale(s)...\n`);

  for (const p of plans) {
    const owner = userByEmail.get(p.ownerEmail);
    if (!owner) { console.log(`SKIP ${p.addr1}: owner ${p.ownerEmail} not found`); continue; }
    const idemKey = `bw-mig-${p.address.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const already = await prisma.propertyTransaction.findUnique({ where: { migrationIdempotencyKey: idemKey }, select: { id: true, migrationFinalizedAt: true } });
    if (already?.migrationFinalizedAt) { console.log(`DEDUP ${p.addr1}: already imported (${already.id})`); continue; }

    const compl = p.completions.map((c) => ({ milestoneDefinitionId: defIdByCode.get(c.code)!, eventDate: c.iso })).filter((c) => c.milestoneDefinitionId);
    console.log(`${WRITE ? "IMPORT" : "DRY   "} ${p.addr1}  | owner ${p.ownerEmail} | ${p.tenure}${p.sof ? "/SoF" : ""}${p.managed ? "/managed" : ""} ${p.method} £${p.price ?? "?"} | ${p.contacts.length} contacts | ${compl.length} milestones | ${p.sticky.length} sticky`);
    if (!WRITE) continue;

    // solicitors
    const vSol = p.sol.vendor ? await findOrCreateSolicitor(p.sol.vendor) : null;
    const pSol = p.sol.purchaser ? await findOrCreateSolicitor(p.sol.purchaser) : null;

    const tx = await createTransaction({
      propertyAddress: normaliseAddressString(p.addr1 + ", " + p.address.split(", ").slice(1).join(", ")),
      agencyId, agentUserId: owner.id, assignedUserId: undefined, progressedBy: "agent",
      createdAt: new Date(p.agreedIso), isMigrated: true, migratedAt: new Date(), clientEmailsPaused: true,
      migrationIdempotencyKey: idemKey, purchasePrice: p.price, tenure: p.tenure,
      isShareOfFreehold: p.tenure === "leasehold" ? p.sof : false, purchaseType: p.method, notes: null,
      vendorSolicitorFirmId: vSol?.firmId ?? null, vendorSolicitorContactId: vSol?.contactId ?? null,
      purchaserSolicitorFirmId: pSol?.firmId ?? null, purchaserSolicitorContactId: pSol?.contactId ?? null,
    } as Parameters<typeof createTransaction>[0]);

    if (p.managed) await prisma.propertyTransaction.update({ where: { id: tx.id }, data: { hasManagementPack: true } });

    const existingContacts = await prisma.contact.count({ where: { propertyTransactionId: tx.id } });
    if (existingContacts === 0) {
      await prisma.contact.createMany({
        data: p.contacts.map((c) => ({
          propertyTransactionId: tx.id, name: c.name, companyName: c.companyName ?? null, isBusiness: !!c.companyName,
          phone: c.phone, email: c.email, roleType: c.roleType, portalToken: randomUUID(),
          buyerRoundId: c.roleType === "purchaser" ? tx.activeBuyerRoundId : null,
        })),
      });
    }

    await initializeMilestoneCompletions(tx.id, p.tenure, p.method, owner.id, tx.activeBuyerRoundId);
    if (compl.length > 0) {
      const { applied } = await applyMigratedMilestoneCompletions({ transactionId: tx.id, completions: compl, completerId: null });
      if (applied !== compl.length) { console.log(`   !! only ${applied}/${compl.length} milestones applied`); }
    }
    if (p.sticky.length > 0) {
      await prisma.stickyNote.create({ data: { transactionId: tx.id, text: `Expected dates (from migration):\n${p.sticky.join("\n")}`, colour: "butter", createdByName: "Migration" } });
    }
    await prisma.propertyTransaction.update({ where: { id: tx.id }, data: { migrationFinalizedAt: new Date() } });
    console.log(`   -> created ${tx.id}`);
  }
  console.log("\nDone.");
}

// ---- chain linking (real file <-> real file), silent ----
async function linkChains(_plans: Plan[], _agencyId: string) {
  const findTx = async (addr1: string) => prisma.propertyTransaction.findFirst({
    where: { migrationIdempotencyKey: { startsWith: "bw-mig-" }, propertyAddress: { startsWith: addr1 } },
    select: { id: true, propertyAddress: true, agentUserId: true, chainLinkId: true },
  });
  const limited = ONLY ? CHAIN_PAIRS.filter((p) => p.below.toLowerCase().startsWith(ONLY) || p.above.toLowerCase().startsWith(ONLY)) : CHAIN_PAIRS.slice(0, LIMIT);
  for (const pair of limited) {
    const above = await findTx(pair.above); const below = await findTx(pair.below);
    if (!above || !below) { console.log(`SKIP ${pair.person}: file(s) not found (${pair.above} / ${pair.below})`); continue; }
    if (above.chainLinkId || below.chainLinkId) { console.log(`DEDUP ${pair.person}: already chained`); continue; }
    const userId = below.agentUserId ?? above.agentUserId;
    if (!userId) { console.log(`SKIP ${pair.person}: no owner`); continue; }
    console.log(`${WRITE ? "LINK " : "DRY  "} ${pair.person}: [${above.propertyAddress}] above <-> [${below.propertyAddress}] below`);
    if (!WRITE) continue;
    const chain = await createChainV2({ transactionId: below.id, agencyId: _agencyId, userId });
    const res = await selfLinkOwnSale({ chainId: chain.id, userId, transactionId: above.id, context: { kind: "spine", direction: "above" } });
    console.log(res.ok ? `   -> linked (chain ${chain.id})` : `   !! self-link failed: ${res.reason}`);
  }
  console.log("\nChain pass done.");
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
