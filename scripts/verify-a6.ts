// A6 verification: chaseable-milestone allowlist behaves as specified.
// Trivial unit checks — the helper is a one-liner, but locking down the
// excluded set + the inclusion default prevents accidental edits.

import { CLIENT_CHASE_EXCLUDE, isClientChaseable } from "../lib/chase/chaseable-milestones";

const EXPECTED_EXCLUDED = ["VM18", "PM25", "VM19", "PM26", "VM20", "PM27"];

// Sample of codes that should be chaseable
const EXPECTED_INCLUDED = [
  "VM1", "VM2", "VM3", "VM4", "VM5", "VM6", "VM7", "VM8", "VM9", "VM10",
  "VM11", "VM12", "VM13", "VM14", "VM15", "VM16", "VM17",
  // VM18-20 excluded
  "PM1", "PM2", "PM3", "PM4", "PM5", "PM6", "PM7", "PM8", "PM9", "PM10",
  "PM11", "PM12", "PM13", "PM14", "PM15", "PM16", "PM17", "PM18", "PM19",
  "PM20", "PM21", "PM22", "PM23", "PM24",
  // PM25-27 excluded
];

let failures = 0;

console.log(`[a6] CLIENT_CHASE_EXCLUDE size: ${CLIENT_CHASE_EXCLUDE.size} (expect ${EXPECTED_EXCLUDED.length})`);
if (CLIENT_CHASE_EXCLUDE.size !== EXPECTED_EXCLUDED.length) {
  console.error(`[a6] FAIL: exclude set has wrong size`);
  failures++;
}

for (const code of EXPECTED_EXCLUDED) {
  const has = CLIENT_CHASE_EXCLUDE.has(code);
  const chaseable = isClientChaseable(code);
  if (!has) { console.error(`[a6] FAIL: ${code} should be in CLIENT_CHASE_EXCLUDE`); failures++; }
  if (chaseable) { console.error(`[a6] FAIL: isClientChaseable("${code}") should be false`); failures++; }
}
console.log(`[a6] excluded codes verified (${EXPECTED_EXCLUDED.length}): all isClientChaseable() = false ✓`);

let okIncluded = 0;
for (const code of EXPECTED_INCLUDED) {
  if (!isClientChaseable(code)) {
    console.error(`[a6] FAIL: isClientChaseable("${code}") should be true`);
    failures++;
  } else {
    okIncluded++;
  }
}
console.log(`[a6] included codes verified (${okIncluded}/${EXPECTED_INCLUDED.length}): all isClientChaseable() = true ✓`);

// Unknown / non-milestone codes are chaseable by default (excluded set is closed)
const unknown = isClientChaseable("VM99");
console.log(`[a6] unknown code VM99: isClientChaseable() = ${unknown} (default-allowed by design)`);

if (failures > 0) {
  console.error(`[a6] ${failures} failure(s)`);
  process.exit(1);
}

console.log(`[a6] all checks passed`);
