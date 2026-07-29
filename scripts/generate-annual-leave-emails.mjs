// scripts/generate-annual-leave-emails.mjs
// One-shot generator: pulls every active outsourced transaction from prod,
// produces two annual-leave notification emails per file (vendor + purchaser
// side), writes a single markdown doc.
//
// Run: npx dotenv -e .env.production -- node scripts/generate-annual-leave-emails.mjs
//
// Output: docs/annual-leave-emails-2026-07-30.md (repo-relative)

import pg from "pg";
import fs from "node:fs";
import path from "node:path";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

// ── Pull ────────────────────────────────────────────────────────────────
const txs = await c.query(`
  SELECT pt.id, pt."propertyAddress", pt.status::text AS status,
         pt."serviceType"::text AS service, pt.tenure::text AS tenure,
         pt."purchaseType"::text AS pt_type, pt."purchasePrice",
         pt."expectedExchangeDate", pt."overridePredictedDate",
         pt."isShareOfFreehold", pt."completionDate",
         a.name AS agency,
         vfirm.name AS v_firm, vc.name AS v_sol_name, vc.email AS v_sol_email,
         pfirm.name AS p_firm, pc.name AS p_sol_name, pc.email AS p_sol_email
    FROM "PropertyTransaction" pt
    JOIN "Agency" a ON a.id = pt."agencyId"
    LEFT JOIN "SolicitorFirm" vfirm ON vfirm.id = pt."vendorSolicitorFirmId"
    LEFT JOIN "SolicitorContact" vc ON vc.id = pt."vendorSolicitorContactId"
    LEFT JOIN "SolicitorFirm" pfirm ON pfirm.id = pt."purchaserSolicitorFirmId"
    LEFT JOIN "SolicitorContact" pc ON pc.id = pt."purchaserSolicitorContactId"
   WHERE pt.status = 'active'
     AND pt."serviceType" = 'outsourced'
     AND a."isInternal" = false
   ORDER BY pt."propertyAddress"
`);
console.log(`Loaded ${txs.rows.length} active outsourced transactions`);

const txIds = txs.rows.map((r) => r.id);
const contacts = await c.query(`
  SELECT "propertyTransactionId" AS tx_id, name, "roleType"::text AS role, email, "unsubscribedAt"
    FROM "Contact"
   WHERE "propertyTransactionId" = ANY($1::text[])
   ORDER BY name
`, [txIds]);
const contactsByTx = new Map();
for (const r of contacts.rows) {
  const arr = contactsByTx.get(r.tx_id) ?? [];
  arr.push(r);
  contactsByTx.set(r.tx_id, arr);
}

const mcRows = await c.query(`
  SELECT mc."transactionId" AS tx_id, md.code, md.side::text AS side,
         mc.state::text AS state, mc."completedAt"
    FROM "MilestoneCompletion" mc
    JOIN "MilestoneDefinition" md ON md.id = mc."milestoneDefinitionId"
   WHERE mc."transactionId" = ANY($1::text[])
`, [txIds]);
const mcByTx = new Map();
for (const r of mcRows.rows) {
  const map = mcByTx.get(r.tx_id) ?? new Map();
  map.set(r.code, { state: r.state, completedAt: r.completedAt, side: r.side });
  mcByTx.set(r.tx_id, map);
}

// ── Helpers ─────────────────────────────────────────────────────────────
const stripTitle = (name) => {
  if (!name) return "";
  const titles = /^(mr|mrs|ms|miss|mx|dr|prof|sir|dame|lord|lady|rev)\.?\s+/i;
  const cleaned = name.trim().replace(titles, "");
  return cleaned || name.trim();
};
const firstName = (name) => stripTitle(name).split(/\s+/)[0] || "";
// Short form of the address: everything before the first comma. Reads more
// naturally in body text than the full postal address.
const shortAddress = (addr) => addr.split(",")[0].trim();
// Normalise firm suffixes: "Llp" → "LLP", "Ltd" → "Ltd" (leave), etc.
const cleanFirm = (name) => {
  if (!name) return name;
  return name
    .replace(/\bLlp\b/g, "LLP")
    .replace(/\bLLp\b/g, "LLP")
    .replace(/\bllp\b/g, "LLP");
};
const isDone = (mc, code) => {
  const r = mc?.get(code);
  return r?.state === "complete" || r?.state === "not_required";
};
const isComplete = (mc, code) => mc?.get(code)?.state === "complete";
const isAvailable = (mc, code) => mc?.get(code)?.state === "available";

// Vendor state summary — returns { doneSentence, waitingSentence }
function describeVendor(mc, tx, vSolFirm, vSolFirstName) {
  const firmRef = vSolFirm ?? "your solicitor";
  const solRef = vSolFirstName ?? "your solicitor";

  // Onboarding: VM1-6
  const done = {
    VM1: isComplete(mc, "VM1"),
    VM2: isComplete(mc, "VM2"),
    VM3: isComplete(mc, "VM3"),
    VM4: isComplete(mc, "VM4"),
    VM5: isComplete(mc, "VM5"),
    VM6: isComplete(mc, "VM6"),
  };
  const doneItems = [];
  if (done.VM1) doneItems.push(`instructed ${firmRef}`);
  if (done.VM2) doneItems.push("received our memorandum of sale");
  if (done.VM3) doneItems.push("received your welcome pack");
  if (done.VM4) doneItems.push("completed your ID and AML checks");
  if (done.VM5) doneItems.push("your property information forms have arrived");
  if (done.VM6) doneItems.push("returned your completed property information forms");

  const allOnboard = done.VM1 && done.VM2 && done.VM3 && done.VM4 && done.VM5 && done.VM6;
  const almostOnboard = done.VM1 && done.VM2 && done.VM3 && done.VM4 && done.VM5 && !done.VM6;
  const partOnboard = !allOnboard && !almostOnboard && doneItems.length > 0;
  const nothingDone = doneItems.length === 0;

  let onboardLine;
  if (allOnboard) onboardLine = "Your onboarding is complete.";
  else if (almostOnboard) onboardLine = "Your onboarding is almost complete.";
  else if (partOnboard) onboardLine = "Your onboarding is underway.";
  else onboardLine = "";

  // If further along, add the post-onboarding summary
  const extraDone = [];
  if (allOnboard) {
    if (isDone(mc, "VM7")) extraDone.push(`${firmRef} has issued the draft contract pack to the buyer's side`);
    if (isDone(mc, "VM11")) extraDone.push("you've provided your initial enquiry replies");
    if (isDone(mc, "VM12")) extraDone.push("initial enquiry replies have been sent to the buyer's solicitor");
    if (isDone(mc, "VM14")) extraDone.push("you've provided the additional enquiry replies");
    if (isDone(mc, "VM15")) extraDone.push("additional enquiry replies have been sent");
    if (isComplete(mc, "VM17")) extraDone.push("you've signed and returned your contract documents");
    if (isComplete(mc, "VM18")) extraDone.push(`${solRef} has confirmed readiness to exchange`);
    if (isComplete(mc, "VM19")) extraDone.push("contracts have been exchanged");
  }

  // Compose done sentence
  const parts = [];
  if (onboardLine) parts.push(onboardLine);
  if (doneItems.length > 0) {
    const list = doneItems.length === 1
      ? doneItems[0]
      : doneItems.slice(0, -1).join(", ") + ", and " + doneItems[doneItems.length - 1];
    parts.push(`You've ${list}.`);
  }
  for (const item of extraDone) {
    // Each extra as its own sentence — reads cleaner than semicolon-joined lists
    const s = item.charAt(0).toUpperCase() + item.slice(1);
    parts.push(`${s}.`);
  }
  const doneSentence = parts.join(" ");

  // Waiting-on
  let waiting = null;
  if (isComplete(mc, "VM19") && !isComplete(mc, "VM20"))
    waiting = "The main thing we're waiting on is completion day itself.";
  else if (isComplete(mc, "VM18") && !isComplete(mc, "VM19"))
    waiting = `The main thing we're waiting on is the buyer's side confirming readiness so ${solRef} can exchange contracts.`;
  else if (isComplete(mc, "VM17") && !isComplete(mc, "VM18"))
    waiting = `The main thing we're waiting on is ${solRef} confirming readiness to exchange.`;
  else if (isDone(mc, "VM16") && !isComplete(mc, "VM17"))
    waiting = "The main thing we're waiting on is your signed contract documents coming back to " + solRef + ".";
  else if (isDone(mc, "VM15") && !isDone(mc, "VM16"))
    waiting = `The main thing we're waiting on is ${solRef} issuing your contract documents for signature.`;
  else if (isAvailable(mc, "VM14"))
    waiting = "The main thing we're waiting on is your input on the additional enquiries raised by the buyer's solicitor.";
  else if (isAvailable(mc, "VM13"))
    waiting = "The main thing we're waiting on is the next round of enquiries from the buyer's solicitor.";
  else if (isAvailable(mc, "VM11"))
    waiting = "The main thing we're waiting on is your input on the enquiries raised by the buyer's solicitor.";
  else if (isAvailable(mc, "VM10"))
    waiting = "The main thing we're waiting on is enquiries coming through from the buyer's solicitor.";
  else if (isAvailable(mc, "VM9"))
    waiting = "The main thing we're waiting on is the management pack from your freeholder.";
  else if (isAvailable(mc, "VM8"))
    waiting = `The main thing we're waiting on is ${solRef} requesting the management pack from your freeholder.`;
  else if (isAvailable(mc, "VM7"))
    waiting = `The main thing we're waiting on is ${solRef} issuing the draft contract pack to the buyer's side.`;
  else if (isAvailable(mc, "VM6"))
    waiting = `The main thing we're waiting on is your completed property information forms coming back to ${solRef}. Once they're returned, ${solRef} can issue the draft contract pack to the buyer's side and the transaction moves forward.`;
  else if (isAvailable(mc, "VM5"))
    waiting = `The main thing we're waiting on is ${solRef} sending you the property information forms to complete.`;
  else if (isAvailable(mc, "VM4"))
    waiting = "The main thing we're waiting on is your ID and AML checks being completed with your solicitor.";
  else if (isAvailable(mc, "VM3"))
    waiting = `The main thing we're waiting on is you receiving your welcome pack from ${solRef}.`;
  else if (isAvailable(mc, "VM1"))
    waiting = "The main thing we're waiting on is you formally instructing your solicitor.";
  else
    waiting = "We're between steps at the moment, and I'll follow up with next actions once the buyer's side is ready.";

  return { doneSentence, waiting };
}

// Purchaser state summary
function describePurchaser(mc, tx, pSolFirm, pSolFirstName) {
  const firmRef = pSolFirm ?? "your solicitor";
  const solRef = pSolFirstName ?? "your solicitor";
  const hasMortgage = tx.pt_type === "mortgage";

  const done = {
    PM1: isComplete(mc, "PM1"),
    PM2: isComplete(mc, "PM2"),
    PM3: isComplete(mc, "PM3"),
    PM4: isComplete(mc, "PM4"),
  };
  const doneItems = [];
  if (done.PM1) doneItems.push(`instructed ${firmRef}`);
  if (done.PM2) doneItems.push("received our memorandum of sale");
  if (done.PM3) doneItems.push("completed your ID and AML checks");
  if (done.PM4) doneItems.push("transferred your money on account");

  const allOnboard = done.PM1 && done.PM2 && done.PM3 && done.PM4;
  const almostOnboard = !allOnboard && Object.values(done).filter(Boolean).length >= 2;
  let onboardLine;
  if (allOnboard) onboardLine = "Your onboarding is complete.";
  else if (almostOnboard) onboardLine = "Your onboarding is almost complete.";
  else if (doneItems.length > 0) onboardLine = "Your onboarding is underway.";
  else onboardLine = "";

  const extraDone = [];
  if (hasMortgage) {
    if (isComplete(mc, "PM5")) extraDone.push("your mortgage application is in");
    if (isComplete(mc, "PM6")) extraDone.push("your lender's valuation has been booked");
    if (isComplete(mc, "PM11")) extraDone.push("your mortgage offer has been issued");
  }
  if (isComplete(mc, "PM7")) extraDone.push(`the draft contract pack has arrived with ${solRef}`);
  if (isComplete(mc, "PM8")) extraDone.push("searches have been ordered");
  if (isComplete(mc, "PM13")) extraDone.push("search results have come back");
  if (isComplete(mc, "PM14")) extraDone.push("initial enquiries have been raised with the seller's side");
  if (isComplete(mc, "PM15")) extraDone.push("initial replies have come back from the seller's solicitor");
  if (isComplete(mc, "PM16")) extraDone.push(`${solRef} has reviewed the initial replies`);
  if (isComplete(mc, "PM17")) extraDone.push("additional enquiries have been raised");
  if (isComplete(mc, "PM18")) extraDone.push("additional replies have come back");
  if (isComplete(mc, "PM19")) extraDone.push(`${solRef} has reviewed the additional replies`);
  if (isComplete(mc, "PM20")) extraDone.push("all legal enquiries have been satisfied");
  if (isComplete(mc, "PM21")) extraDone.push(`you've received your final report from ${solRef}`);
  if (isComplete(mc, "PM23")) extraDone.push("you've signed and returned your contract documents");
  if (isComplete(mc, "PM24")) extraDone.push("your deposit has been transferred");
  if (isComplete(mc, "PM25")) extraDone.push(`${solRef} has confirmed readiness to exchange`);
  if (isComplete(mc, "PM26")) extraDone.push("contracts have been exchanged");

  const parts = [];
  if (onboardLine) parts.push(onboardLine);
  if (doneItems.length > 0) {
    const list = doneItems.length === 1
      ? doneItems[0]
      : doneItems.slice(0, -1).join(", ") + ", and " + doneItems[doneItems.length - 1];
    parts.push(`You've ${list}.`);
  }
  for (const item of extraDone) {
    const s = item.charAt(0).toUpperCase() + item.slice(1);
    parts.push(`${s}.`);
  }
  const doneSentence = parts.join(" ");

  // Waiting-on — combine parallel waits when relevant
  const waits = [];
  if (hasMortgage && !isComplete(mc, "PM11") && (isComplete(mc, "PM5") || isComplete(mc, "PM6")))
    waits.push("your mortgage offer coming through from the lender");
  if (isAvailable(mc, "PM7"))
    waits.push("the draft contract pack arriving from the seller's solicitor");
  if (isDone(mc, "PM7") && isAvailable(mc, "PM8"))
    waits.push(`${solRef} ordering searches`);
  if (isDone(mc, "PM8") && isAvailable(mc, "PM13"))
    waits.push("search results coming back");
  if (isDone(mc, "PM13") && isDone(mc, "PM7") && isAvailable(mc, "PM14"))
    waits.push(`${solRef} raising initial enquiries with the seller's side`);
  if (isDone(mc, "PM14") && isAvailable(mc, "PM15"))
    waits.push("replies to enquiries coming back from the seller's solicitor");
  if (isDone(mc, "PM15") && isAvailable(mc, "PM16"))
    waits.push(`${solRef} reviewing the initial replies`);
  if (isDone(mc, "PM16") && isAvailable(mc, "PM17"))
    waits.push("the next round of enquiries being raised");
  if (isDone(mc, "PM17") && isAvailable(mc, "PM18"))
    waits.push("the additional replies coming back");
  if (isDone(mc, "PM20") && isAvailable(mc, "PM21"))
    waits.push(`your final report from ${solRef}`);
  if (isDone(mc, "PM21") && isAvailable(mc, "PM22"))
    waits.push(`${solRef} issuing your contract documents`);
  if (isDone(mc, "PM22") && isAvailable(mc, "PM23"))
    waits.push("your signed contract documents coming back");
  if (isDone(mc, "PM23") && isAvailable(mc, "PM24"))
    waits.push("your deposit being transferred");
  if (isDone(mc, "PM24") && isAvailable(mc, "PM25"))
    waits.push(`${solRef} confirming readiness to exchange`);
  if (isDone(mc, "PM25") && isAvailable(mc, "PM26"))
    waits.push("the exchange event itself");
  if (isComplete(mc, "PM26") && !isComplete(mc, "PM27"))
    waits.push("completion day itself");

  let waiting;
  if (waits.length === 0)
    waiting = "We're between steps at the moment, and I'll follow up with next actions once things move forward on the other side.";
  else if (waits.length === 1)
    waiting = `The main thing we're waiting on is ${waits[0]}.`;
  else if (waits.length === 2)
    waiting = `The main things we're waiting on are ${waits[0]}, and ${waits[1]}.`;
  else
    waiting = `The main things we're waiting on are ${waits.slice(0, -1).join(", ")}, and ${waits[waits.length - 1]}.`;

  return { doneSentence, waiting };
}

// Email builders
function vendorEmail(tx, mc) {
  const cs = contactsByTx.get(tx.id) ?? [];
  const vendor = cs.find((c) => c.role === "vendor");
  const vendorFN = vendor ? firstName(vendor.name) : "there";
  const vSolFN = tx.v_sol_name ? firstName(tx.v_sol_name) : null;
  const vFirm = cleanFirm(tx.v_firm);
  const { doneSentence, waiting } = describeVendor(mc, tx, vFirm, vSolFN);

  const to = vendor?.email ?? "(no vendor email on file)";
  const optedOut = vendor?.unsubscribedAt ? " [OPTED OUT — do not send]" : "";
  const cc = tx.v_sol_email ?? "(no vendor solicitor email on file)";

  const solRef = vSolFN ?? "your solicitor";
  const shortAddr = shortAddress(tx.propertyAddress);

  return `**To:** ${to}${optedOut}
**Cc:** ${cc}
**Subject:** Where we're at with ${shortAddr}, and I'm away 30 July to 9 August

Hi ${vendorFN},

A quick note to let you know I'll be on annual leave from Thursday 30 July, back at my desk on Monday 10 August.

Here's my understanding of where your sale at ${shortAddr} stands right now:
${doneSentence}
${waiting}
If anything above is incorrect, please let us know and we'll update our portal so it reflects the real picture.

If there's anything you or ${solRef} would like me to sort before I go, whether that's a chase to the other side, a document, or a call, please let me know within the next 24 hours so I have time to get it done. Anything less pressing I'll pick up first thing Monday 10 August!`;
}

function purchaserEmail(tx, mc) {
  const cs = contactsByTx.get(tx.id) ?? [];
  const purchaser = cs.find((c) => c.role === "purchaser");
  const purchaserFN = purchaser ? firstName(purchaser.name) : "there";
  const pSolFN = tx.p_sol_name ? firstName(tx.p_sol_name) : null;
  const pFirm = cleanFirm(tx.p_firm);
  const { doneSentence, waiting } = describePurchaser(mc, tx, pFirm, pSolFN);

  const to = purchaser?.email ?? "(no purchaser email on file)";
  const optedOut = purchaser?.unsubscribedAt ? " [OPTED OUT — do not send]" : "";
  const cc = tx.p_sol_email ?? "(no purchaser solicitor email on file)";

  const solRef = pSolFN ?? "your solicitor";
  const shortAddr = shortAddress(tx.propertyAddress);

  return `**To:** ${to}${optedOut}
**Cc:** ${cc}
**Subject:** Where we're at with ${shortAddr}, and I'm away 30 July to 9 August

Hi ${purchaserFN},

A quick note to let you know I'll be on annual leave from Thursday 30 July, back at my desk on Monday 10 August.

Here's my understanding of where your purchase of ${shortAddr} stands right now:
${doneSentence}
${waiting}
If anything above is incorrect, please let us know and we'll update our portal so it reflects the real picture.

If there's anything you or ${solRef} would like me to sort before I go, whether that's a chase to the other side, a document, or a call, please let me know within the next 24 hours so I have time to get it done. Anything less pressing I'll pick up first thing Monday 10 August!`;
}

// ── Assemble the doc ────────────────────────────────────────────────────
const sections = [];
sections.push(`# Annual leave emails — 30 July to 9 August 2026`);
sections.push(``);
sections.push(`Generated ${new Date().toISOString().slice(0, 10)}. ${txs.rows.length} active outsourced files. Two emails per file (vendor + purchaser side). Solicitor CC'd on each.`);
sections.push(``);
sections.push(`Any file below where a contact or solicitor email is missing is flagged inline. Opted-out contacts are flagged too — do not send to those.`);
sections.push(``);
sections.push(`---`);

let warnings = 0;
for (const tx of txs.rows) {
  const mc = mcByTx.get(tx.id) ?? new Map();
  sections.push(``);
  sections.push(`## ${tx.propertyAddress}`);
  sections.push(``);
  sections.push(`Agency: **${tx.agency}** · Tenure: ${tx.tenure} · Buyer type: ${tx.pt_type ?? "unspecified"}`);
  sections.push(``);
  sections.push(`### Vendor side`);
  sections.push(``);
  const ve = vendorEmail(tx, mc);
  sections.push(ve);
  if (ve.includes("(no ")) warnings++;
  sections.push(``);
  sections.push(`### Purchaser side`);
  sections.push(``);
  const pe = purchaserEmail(tx, mc);
  sections.push(pe);
  if (pe.includes("(no ")) warnings++;
  sections.push(``);
  sections.push(`---`);
}

sections.push(``);
sections.push(`## Summary`);
sections.push(``);
sections.push(`- Total files: **${txs.rows.length}**`);
sections.push(`- Total emails to send: **${txs.rows.length * 2}**`);
sections.push(`- Missing-contact warnings inline: **${warnings}**`);
sections.push(``);

const outPath = path.join(process.cwd(), "docs", "annual-leave-emails-2026-07-30.md");
fs.writeFileSync(outPath, sections.join("\n"), "utf8");
console.log(`\nWrote ${outPath}`);
console.log(`${txs.rows.length} files, ${txs.rows.length * 2} emails, ${warnings} missing-detail warnings.`);

await c.end();
