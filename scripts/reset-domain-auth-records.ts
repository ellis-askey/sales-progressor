// One-shot: reset a PENDING domain authentication onto TSP's collision-resistant
// return path + DKIM selector.
//
// Why this exists: our old createAuthenticatedDomain used SendGrid's default
// "em" return path and "s1"/"s2" DKIM selectors. When an agency's domain is
// already authenticated with a *different* SendGrid account, those host names
// collide (e.g. expuk.com already had em/s1/s2 records), so the customer can't
// add ours without clobbering the other account's DNS. New authentications now
// use "tsp" (see lib/services/sendgrid.ts). This script migrates an already-
// created PENDING authentication onto the new records.
//
// SendGrid can't edit subdomain/custom_dkim_selector on an existing whitelabel
// domain, so the only path is delete-and-recreate. That is safe ONLY for a
// pending, never-verified authentication (no live DNS depends on it yet).
//
// SAFE BY DESIGN:
//   - Dry-run by default. Prints what it WOULD do. Pass APPLY=1 to execute.
//   - Prints the connected database host + SendGrid key presence first.
//   - HARD-REFUSES any domain whose VerifiedDomain.status === "verified", and
//     re-checks live SendGrid validity before deleting — a verified domain has
//     live mail flowing and must never be delete/recreated here.
//
// Usage (staging first, then prod, from your own shell with the right .env):
//   DOMAIN=expuk.com npx tsx scripts/reset-domain-auth-records.ts            # dry run
//   APPLY=1 DOMAIN=expuk.com npx tsx scripts/reset-domain-auth-records.ts    # execute

import { prisma } from "@/lib/prisma";
import {
  createAuthenticatedDomain,
  deleteAuthenticatedDomain,
  validateAuthenticatedDomain,
} from "@/lib/services/sendgrid";

const DOMAIN = (process.env.DOMAIN ?? "").trim().toLowerCase();
const APPLY = process.env.APPLY === "1";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.replace(/^.*@/, "").replace(/\/.*$/, "");
  console.log(`Connected to: ${host || "(unknown)"}`);
  console.log(`SendGrid key: ${process.env.SENDGRID_API_KEY ? "present" : "MISSING"}`);
  console.log(`Target domain: ${DOMAIN || "(none, set DOMAIN=...)"}`);
  console.log(APPLY ? "MODE: APPLY (will delete + recreate)\n" : "MODE: dry-run (no writes)\n");

  if (!DOMAIN) {
    console.log("Set DOMAIN=<domain>, e.g. DOMAIN=expuk.com. Aborting.");
    process.exit(1);
  }
  if (!process.env.SENDGRID_API_KEY) {
    console.log("SENDGRID_API_KEY not set. Aborting.");
    process.exit(1);
  }

  const rows = await prisma.verifiedDomain.findMany({ where: { domain: DOMAIN } });
  if (rows.length === 0) {
    console.log(`No VerifiedDomain row for ${DOMAIN}. Nothing to do.`);
    return;
  }

  // A domain can back MULTIPLE agencies (e.g. several eXp agents all sending
  // from expuk.com). They correctly SHARE one SendGrid authentication — one
  // domain has one set of DNS records that authenticates every sender on it. So
  // this operates per-domain, not per-row: delete the shared old record ONCE,
  // create ONE new tsp record, and repoint every row to it. Recreating per-row
  // would delete the shared record out from under the other agencies' rows.
  for (const vd of rows) {
    console.log(
      `Row ${vd.id} / agency ${vd.agencyId} / status=${vd.status} / sendgridDomainId=${vd.sendgridDomainId}`
    );
  }
  console.log("");

  // Guard 1: refuse the whole operation if ANY row is verified — a verified
  // domain has live mail flowing through the shared record; never touch it.
  const verified = rows.filter((r) => r.status === "verified");
  if (verified.length > 0) {
    console.log(`REFUSING: ${verified.length} row(s) are 'verified'. Shared record has live mail. Aborting.`);
    return;
  }

  // Every distinct old SendGrid record backing this domain (normally just one).
  const oldIds = [...new Set(rows.map((r) => r.sendgridDomainId))];

  // Guard 2: refuse if SendGrid still reports any of them valid.
  for (const id of oldIds) {
    let live;
    try {
      live = await validateAuthenticatedDomain(id);
    } catch {
      console.log(`Could not reach SendGrid to re-check record ${id}. Aborting for safety.`);
      return;
    }
    if (live.valid) {
      console.log(`REFUSING: SendGrid reports record ${id} is VALID (live). Aborting.`);
      return;
    }
  }

  if (!APPLY) {
    console.log(`WOULD delete old record(s) [${oldIds.join(", ")}], create ONE new tsp record,`);
    console.log(`and repoint all ${rows.length} row(s) to it.`);
    console.log("\nDry run only. Re-run with APPLY=1 to execute.");
    return;
  }

  // Delete every old (collision-prone) shared record.
  for (const id of oldIds) {
    await deleteAuthenticatedDomain(id);
    console.log(`Deleted old SendGrid whitelabel ${id}.`);
  }

  // Create ONE new record with the tsp return path + DKIM selector. SendGrid
  // generates the fresh CNAME records; we store exactly what it returns.
  const { id: newId, cnameRecords } = await createAuthenticatedDomain(DOMAIN);
  console.log(`Created new SendGrid whitelabel ${newId} with ${cnameRecords.length} records.`);

  // Repoint every row for this domain to the shared new record.
  for (const vd of rows) {
    await prisma.verifiedDomain.update({
      where: { id: vd.id },
      data: {
        sendgridDomainId: newId,
        cnameRecords: cnameRecords as object[],
        status: "pending",
        dkimValid: false,
        spfValid: false,
        verifiedAt: null,
        lastCheckedAt: null,
      },
    });
    console.log(`  Repointed row ${vd.id} (agency ${vd.agencyId}).`);
  }

  console.log("\nNew shared records now show on every agency's setup screen:");
  for (const r of cnameRecords) console.log(`  CNAME  ${r.host}  ->  ${r.data}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
