// Creates a minimal staging fixture for walking the /claim pages.
// Uses pg directly (avoids Prisma Accelerate engine requirement in scripts).
// Run: npx tsx scripts/create-claim-fixture.ts

import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { Client } from "pg";
import crypto from "crypto";

const directUrl = (process.env.DIRECT_URL ?? "").replace(/^"|"$/g, "");

async function main() {
  const client = new Client({ connectionString: directUrl });
  await client.connect();

  // Find the most recent transaction on staging
  const txResult = await client.query(
    `SELECT id, "propertyAddress", "agencyId", "agentUserId" FROM "PropertyTransaction" WHERE "agencyId" IS NOT NULL ORDER BY "createdAt" DESC LIMIT 1`
  );

  if (txResult.rows.length === 0) {
    console.error("No transactions on staging. Create one via the agent app first.");
    await client.end();
    process.exit(1);
  }

  const tx = txResult.rows[0];
  console.log(`Using transaction: ${tx.propertyAddress} (${tx.id})`);

  // Find existing chain for this transaction
  const chainResult = await client.query(
    `SELECT c.id FROM "PropertyChain" c JOIN "ChainLink" l ON l."chainId" = c.id WHERE l."transactionId" = $1 LIMIT 1`,
    [tx.id]
  );

  let chainId: string;

  if (chainResult.rows.length > 0) {
    chainId = chainResult.rows[0].id;
    console.log(`Using existing chain: ${chainId}`);
  } else {
    // Create chain + originator link
    const newChainId = `c_${crypto.randomBytes(12).toString("hex")}`;
    const newLinkId = `l_${crypto.randomBytes(12).toString("hex")}`;
    await client.query(
      `INSERT INTO "PropertyChain" (id, "agencyId", "createdByUserId", status, "createdAt", "updatedAt") VALUES ($1, $2, $3, 'ACTIVE', NOW(), NOW())`,
      [newChainId, tx.agencyId, tx.agentUserId]
    );
    await client.query(
      `INSERT INTO "ChainLink" (id, "chainId", position, "transactionId", "createdByUserId", "inviteStatus", "inviteResendCount", "createdAt", "updatedAt") VALUES ($1, $2, 0, $3, $4, 'NOT_SENT', 0, NOW(), NOW())`,
      [newLinkId, newChainId, tx.id, tx.agentUserId]
    );
    chainId = newChainId;
    console.log(`Created chain: ${chainId}`);
  }

  // Find next available position (delete any old unclaimed test stubs first)
  await client.query(
    `DELETE FROM "ChainLink" WHERE "chainId" = $1 AND "transactionId" IS NULL AND "stubAgentEmail" = 'agent@acmeestates.co.uk'`,
    [chainId]
  );

  const maxPosResult = await client.query(
    `SELECT COALESCE(MAX(position), -1) AS maxpos FROM "ChainLink" WHERE "chainId" = $1`,
    [chainId]
  );
  const nextPosition = (maxPosResult.rows[0].maxpos as number) + 1;

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const stubId = `l_${crypto.randomBytes(12).toString("hex")}`;

  await client.query(
    `INSERT INTO "ChainLink" (id, "chainId", position, "stubPropertyAddress", "stubAgencyName", "stubAgentEmail", "stubAgentName", "inviteStatus", "inviteToken", "inviteTokenExpiresAt", "inviteSentAt", "createdByUserId", "inviteResendCount", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'SENT', $8, $9, NOW(), $10, 0, NOW(), NOW())`,
    [stubId, chainId, nextPosition, "12 Acme Street, Birmingham, B1 1AA", "Acme Estate Agents", "agent@acmeestates.co.uk", "Test Agent", token, expiresAt, tx.agentUserId]
  );

  await client.end();

  const base = "http://localhost:3000";
  console.log("\n--- CLAIM WALK URLS ---");
  console.log(`\nClaim page:   ${base}/claim?token=${token}`);
  console.log(`Decline page: ${base}/claim/decline?token=${token}`);
  console.log(`\nExpires: ${expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
