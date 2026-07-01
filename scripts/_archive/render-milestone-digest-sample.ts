// Render sample milestone-digest output for staging spot-check.
//
// Run:
//   npx ts-node \
//     --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' \
//     --require tsconfig-paths/register \
//     scripts/render-milestone-digest-sample.ts
//
// Output is printed to stdout. No DB, no SendGrid — pure assembler test.
// Use this to eyeball digest copy before merging.

import {
  assembleMilestoneDigest,
  type MilestoneDigestPayload,
} from "../lib/email/milestone-digest";

const PORTAL_URL = "https://portal.thesalesprogressor.co.uk/portal/sample-token/progress";
const ADDRESS = "22 Example Road, London SW1A 1AA";

function payload(
  milestoneCode: string,
  recipientSide: "vendor" | "purchaser",
  firstName = "Alex",
): MilestoneDigestPayload {
  // For the digest path the single-event subject/text/html are unused —
  // the assembler reads only milestoneCode + recipientSide + the per-
  // recipient fields. Fill with placeholders.
  return {
    subject: "[unused on digest path]",
    text: "[unused on digest path]",
    html: "[unused on digest path]",
    milestoneCode,
    recipientSide,
    address: ADDRESS,
    firstName,
    portalUrl: PORTAL_URL,
  };
}

function printScenario(label: string, rows: MilestoneDigestPayload[]): void {
  const assembled = assembleMilestoneDigest(rows);
  console.log(`\n${"=".repeat(72)}`);
  console.log(label);
  console.log("=".repeat(72));
  console.log(`Subject: ${assembled.subject}\n`);
  console.log(assembled.text);
  console.log("");
  console.log("--- HTML ---");
  console.log(assembled.html);
}

// Scenario A: same side, two acted-side events for the vendor.
printScenario("A. Vendor — two acted-side events (VM3 + VM4)", [
  payload("VM4", "vendor"),
  payload("VM3", "vendor"),
]);

// Scenario B: mixed sides for a purchaser.
printScenario("B. Purchaser — one acted (PM7) + one counterpart (VM7)", [
  payload("VM7", "purchaser"),
  payload("PM7", "purchaser"),
]);

// Scenario C: dense digest, vendor, reverse input.
printScenario("C. Vendor — dense (reverse input order: VM7, VM6, VM4, VM2)", [
  payload("VM7", "vendor"),
  payload("VM6", "vendor"),
  payload("VM4", "vendor"),
  payload("VM2", "vendor"),
]);

// Scenario D: cash-from-proceeds buyer mid-journey, multiple counterpart updates.
printScenario(
  "D. Purchaser (CFP) — mixed phase 10/11 acted + counterpart items",
  [
    payload("VM12", "purchaser"),
    payload("PM14", "purchaser"),
    payload("PM17", "purchaser"),
    payload("VM15", "purchaser"),
  ],
);
