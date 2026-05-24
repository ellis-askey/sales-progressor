// Toggle staging-only Agency state for the consolidated browser walk.
// All subcommands hard-abort if DATABASE_URL points at prod.
//
// Subcommands:
//   set-warning <agencyName>   — paymentFailedAt = now (yields amber warning banner on hub)
//   set-blocked <agencyName>   — paymentFailedAt = 8d ago + newFileCreationBlockedAt = now
//                                (yields red blocked banner + create-blocked 402)
//   clear <agencyName>         — clears both block flags (back to ok)
//   enable-vat <agencyName>    — vatRegisteredAt = now, vatRateBps = 2000 (20%)
//   disable-vat <agencyName>   — clears vatRegisteredAt and vatRateBps
//   show <agencyName>          — prints the current relevant fields
//
// Run: npx ts-node --transpile-only --compiler-options '{"module":"CommonJS",
//        "moduleResolution":"node","baseUrl":".","paths":{"@/*":["./*"]}}'
//        --require tsconfig-paths/register
//        scripts/staging-billing-state.ts <subcommand> "<agency name>"

import { PrismaClient } from "@prisma/client";

const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";
const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";

function projectIdOf(url: string | undefined): string {
  const m = url?.match(/(?:postgres\.|db\.)([a-z0-9]{20})/);
  return m ? m[1] : "UNKNOWN";
}

async function main() {
  const dbProj = projectIdOf(process.env.DATABASE_URL);
  if (dbProj === PROD_PROJECT_ID) {
    console.error("ABORT — DATABASE_URL points at PRODUCTION. Staging-only script.");
    process.exit(1);
  }
  if (dbProj !== STAGING_PROJECT_ID) {
    console.error(`ABORT — DATABASE_URL project id (${dbProj}) isn't staging.`);
    process.exit(1);
  }

  const [subcommand, agencyName] = process.argv.slice(2);
  if (!subcommand || !agencyName) {
    console.error("Usage: staging-billing-state.ts <subcommand> <agencyName>");
    console.error("  subcommands: set-warning | set-blocked | clear | enable-vat | disable-vat | show");
    process.exit(1);
  }

  const p = new PrismaClient();
  try {
    const agency = await p.agency.findFirst({ where: { name: agencyName } });
    if (!agency) {
      console.error(`No agency named "${agencyName}" on staging`);
      process.exit(1);
    }
    const now = new Date();
    switch (subcommand) {
      case "set-warning":
        await p.agency.update({
          where: { id: agency.id },
          data: { paymentFailedAt: now, newFileCreationBlockedAt: null },
        });
        console.log(`✓ "${agencyName}" → warning state (paymentFailedAt = now, no block yet)`);
        console.log(`  Hub banner should now show amber. Director can still create files.`);
        break;
      case "set-blocked":
        await p.agency.update({
          where: { id: agency.id },
          data: {
            paymentFailedAt: new Date(now.getTime() - 15 * 24 * 3600 * 1000),
            newFileCreationBlockedAt: now,
          },
        });
        console.log(`✓ "${agencyName}" → blocked state (paymentFailedAt 15d ago, blocked now)`);
        console.log(`  Hub banner should now show red. New file creation refused with 402.`);
        break;
      case "clear":
        await p.agency.update({
          where: { id: agency.id },
          data: { paymentFailedAt: null, newFileCreationBlockedAt: null },
        });
        console.log(`✓ "${agencyName}" → ok state (both flags cleared)`);
        break;
      case "enable-vat":
        await p.agency.update({
          where: { id: agency.id },
          data: { vatRegisteredAt: now, vatRateBps: 2000 },
        });
        console.log(`✓ "${agencyName}" → VAT-registered (rate 20%)`);
        console.log(`  /agent/billing should now show ex-VAT + VAT breakdown.`);
        break;
      case "disable-vat":
        await p.agency.update({
          where: { id: agency.id },
          data: { vatRegisteredAt: null, vatRateBps: null },
        });
        console.log(`✓ "${agencyName}" → not VAT-registered`);
        console.log(`  /agent/billing reverts to inclusive-only display.`);
        break;
      case "show": {
        const a = await p.agency.findUnique({
          where: { id: agency.id },
          select: {
            name: true, firstSubmissionAt: true,
            paymentFailedAt: true, newFileCreationBlockedAt: true,
            vatRegisteredAt: true, vatRateBps: true,
            stripeCustomerId: true,
          },
        });
        console.log(JSON.stringify(a, null, 2));
        break;
      }
      default:
        console.error(`Unknown subcommand: ${subcommand}`);
        process.exit(1);
    }
  } finally {
    await p.$disconnect();
  }
}

void main();
