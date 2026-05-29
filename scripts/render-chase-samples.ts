// One-shot: render representative chase digests covering all three tones
// plus a mix of chaseLabel vs label-fallback codes. Pure — no DB, no send.
//
// Run:
//   npx ts-node \
//     --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' \
//     --require tsconfig-paths/register \
//     scripts/render-chase-samples.ts

import { assembleDigestPayload } from "../lib/email/client-chase-digest";

const TX = { id: "txn_sample", propertyAddress: "22 Example Road, London SW1A 1AA" };
const CONTACT = { id: "ctc_sample", name: "Jane Doe", portalToken: "sample-token" };
const AGENCY = "Brennan & Co";

function render(label: string, codes: string[]): void {
  const out = assembleDigestPayload({
    transaction: TX,
    contact: CONTACT,
    milestones: codes.map((code) => ({ code })),
    agencyName: AGENCY,
  });
  console.log("\n" + "=".repeat(72));
  console.log(label);
  console.log("=".repeat(72));
  console.log(`Subject: ${out.subject}\n`);
  console.log(out.text.split(/\n\nThanks,/)[0]);
  console.log(`\nThanks,\n${AGENCY}`);
}

// DIY only — codes with imperative labels (no chaseLabel needed)
render("DIY — single, imperative label fallback (VM4)", ["VM4"]);
render("DIY — 3 items, mix of imperative + chaseLabel (PM5/PM9/PM10)", ["PM5", "PM9", "PM10"]);

// NUDGE-solicitor — should use chaseLabel for all
render("NUDGE — single solicitor (VM10)", ["VM10"]);
render("NUDGE — 3 solicitor items (VM10/VM12/VM9)", ["VM10", "VM12", "VM9"]);
render("NUDGE — 4 purchaser solicitor items (PM7/PM8/PM13/PM14)", ["PM7", "PM8", "PM13", "PM14"]);

// NUDGE-lender — should use chaseLabel
render("NUDGE — single lender (PM6)", ["PM6"]);
render("NUDGE — 2 lender items (PM6/PM11)", ["PM6", "PM11"]);

// NUDGE-mixed (solicitor + lender)
render("NUDGE — mixed solicitor + lender (PM8/PM11)", ["PM8", "PM11"]);

// MIXED tone — DIY + NUDGE
render("MIXED — 2 DIY + 2 NUDGE solicitor (PM5/PM9 + PM13/PM15)", ["PM5", "PM9", "PM13", "PM15"]);
render("MIXED — DIY-passive + NUDGE (PM10 + PM8)", ["PM10", "PM8"]);
render("MIXED — vendor DIY-passive + NUDGE (VM3 + VM10)", ["VM3", "VM10"]);

// VM2 / PM2 — post-reclassify to DIY (who: "you"). Should render under
// the DIY opener now, NOT under "sitting with your solicitor".
render("VM2 — DIY single after reclassify", ["VM2"]);
render("PM2 — DIY single after reclassify", ["PM2"]);
render("VM2 + VM4 — DIY pair after reclassify", ["VM2", "VM4"]);
