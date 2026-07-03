// scripts/fix-broken-postcodes.mjs
// One-shot retroactive fix: uppercase the postcode segment of every
// PropertyTransaction.propertyAddress and ChainLink.stubPropertyAddress
// where it's currently mixed-case.
//
// Dry-run by default. Pass --commit to write.
// Run: npx dotenv -e .env.production -- node scripts/fix-broken-postcodes.mjs [--commit]

import pg from "pg";

const COMMIT = process.argv.includes("--commit");
console.log(COMMIT ? "MODE: COMMIT" : "MODE: DRY-RUN (pass --commit to write)");

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

// Same regex the app uses in lib/utils/address.ts, applied here to build
// the corrected string per row.
const POSTCODE_TOKEN_REGEX = /\b([A-Za-z]{1,2}[0-9][0-9A-Za-z]?)\s*([0-9][A-Za-z]{2})\b/;

function normaliseAddress(raw) {
  if (!raw) return raw;
  const match = raw.match(POSTCODE_TOKEN_REGEX);
  if (!match) return raw;
  const canonical = `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
  return raw.replace(POSTCODE_TOKEN_REGEX, canonical);
}

const BROKEN_SQL_TX = `
    "propertyAddress" ~ '\\y[A-Za-z]{1,2}[0-9][0-9A-Za-z]?\\s*[0-9][A-Za-z]{2}\\y'
AND "propertyAddress" !~ '\\y[A-Z]{1,2}[0-9][0-9A-Z]?\\s+[0-9][A-Z]{2}\\y'
`;
const BROKEN_SQL_CL = `
    "stubPropertyAddress" IS NOT NULL
AND "stubPropertyAddress" ~ '\\y[A-Za-z]{1,2}[0-9][0-9A-Za-z]?\\s*[0-9][A-Za-z]{2}\\y'
AND "stubPropertyAddress" !~ '\\y[A-Z]{1,2}[0-9][0-9A-Z]?\\s+[0-9][A-Z]{2}\\y'
`;

console.log("\n=== PropertyTransaction fixes ===");
const tx = await c.query(`SELECT id, "propertyAddress" FROM "PropertyTransaction" WHERE ${BROKEN_SQL_TX}`);
const txUpdates = [];
for (const r of tx.rows) {
  const fixed = normaliseAddress(r.propertyAddress);
  if (fixed === r.propertyAddress) {
    console.log(`  [SKIP] ${r.id} — regex says broken but normaliser produced no change`);
    continue;
  }
  console.log(`  ${r.id}: "${r.propertyAddress}" → "${fixed}"`);
  txUpdates.push({ id: r.id, fixed });
}

console.log("\n=== ChainLink fixes ===");
const cl = await c.query(`SELECT id, "stubPropertyAddress" FROM "ChainLink" WHERE ${BROKEN_SQL_CL}`);
const clUpdates = [];
for (const r of cl.rows) {
  const fixed = normaliseAddress(r.stubPropertyAddress);
  if (fixed === r.stubPropertyAddress) {
    console.log(`  [SKIP] ${r.id} — regex says broken but normaliser produced no change`);
    continue;
  }
  console.log(`  ${r.id}: "${r.stubPropertyAddress}" → "${fixed}"`);
  clUpdates.push({ id: r.id, fixed });
}

console.log(`\nSummary: ${txUpdates.length} PropertyTransaction, ${clUpdates.length} ChainLink`);

if (!COMMIT) {
  console.log("\nDRY-RUN — no writes performed. Re-run with --commit to apply.");
  await c.end();
  process.exit(0);
}

console.log("\n=== APPLYING ===");
await c.query("BEGIN");
try {
  for (const u of txUpdates) {
    const r = await c.query(
      `UPDATE "PropertyTransaction" SET "propertyAddress" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [u.fixed, u.id],
    );
    if (r.rowCount !== 1) throw new Error(`Expected 1 row updated for tx ${u.id}, got ${r.rowCount}`);
  }
  for (const u of clUpdates) {
    const r = await c.query(
      `UPDATE "ChainLink" SET "stubPropertyAddress" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [u.fixed, u.id],
    );
    if (r.rowCount !== 1) throw new Error(`Expected 1 row updated for cl ${u.id}, got ${r.rowCount}`);
  }
  await c.query("COMMIT");
  console.log(`COMMIT ok — ${txUpdates.length + clUpdates.length} rows updated.`);
} catch (err) {
  await c.query("ROLLBACK");
  console.error("ROLLBACK — " + err.message);
  process.exit(2);
}

await c.end();
