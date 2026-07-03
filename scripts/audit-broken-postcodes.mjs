// scripts/audit-broken-postcodes.mjs
// Find every PropertyTransaction whose propertyAddress contains a
// non-uppercase UK postcode. Read-only.
// Also checks ChainLink.stubPropertyAddress for the same pattern.
// Run: npx dotenv -e .env.production -- node scripts/audit-broken-postcodes.mjs

import pg from "pg";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

// Postcode pattern: L(L)DL(L) DLL, e.g. LU7 0RZ, SW1A 1AA, W1 1AA.
// "Broken" = pattern matches case-insensitively but NOT already all-upper.
const BROKEN_POSTCODE_SQL = `
     "propertyAddress" ~* '\\y[a-z]{1,2}[0-9][0-9a-z]?\\s*[0-9][a-z]{2}\\y'
 AND "propertyAddress" !~ '\\y[A-Z]{1,2}[0-9][0-9A-Z]?\\s+[0-9][A-Z]{2}\\y'
`;

console.log("\n=== PropertyTransaction rows with broken postcodes ===");
const tx = await c.query(`
  SELECT pt.id, pt."propertyAddress", pt.status, pt."createdAt",
         a.name AS agency_name, au.name AS agent_name
    FROM "PropertyTransaction" pt
    JOIN "Agency" a ON a.id = pt."agencyId"
    LEFT JOIN "User" au ON au.id = pt."agentUserId"
   WHERE ${BROKEN_POSTCODE_SQL}
   ORDER BY pt."createdAt" DESC
`);
for (const r of tx.rows) {
  console.log(`  ${r.createdAt.toISOString().slice(0, 10)}  ${r.status.padEnd(10)}  "${r.propertyAddress}"  ${r.agency_name}  ${r.agent_name ?? "—"}  id=${r.id}`);
}
console.log(`  ${tx.rows.length} row(s)`);

console.log("\n=== ChainLink stub addresses with broken postcodes ===");
const cl = await c.query(`
  SELECT id, "stubPropertyAddress", "createdAt"
    FROM "ChainLink"
   WHERE "stubPropertyAddress" IS NOT NULL
     AND (
       "stubPropertyAddress" ~* '\\y[a-z]{1,2}[0-9][0-9a-z]?\\s*[0-9][a-z]{2}\\y'
       AND "stubPropertyAddress" !~ '\\y[A-Z]{1,2}[0-9][0-9A-Z]?\\s+[0-9][A-Z]{2}\\y'
     )
   ORDER BY "createdAt" DESC
`);
for (const r of cl.rows) {
  console.log(`  ${r.createdAt.toISOString().slice(0, 10)}  "${r.stubPropertyAddress}"  id=${r.id}`);
}
console.log(`  ${cl.rows.length} row(s)`);

await c.end();
