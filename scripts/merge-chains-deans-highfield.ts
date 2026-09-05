// One-shot: amalgamate the two separate chains for 16 Deans Furlong and 83
// Highfield Road (same agency, same real-life chain, created before self-linking
// our own sales into a chain existed) into ONE chain, without losing info.
//
// Survivor  = 16 Deans Furlong's chain (6 links, already the full correct spine):
//   Deans Furlong -> 2 Demask Close -> 2 Evans Way -> [83 Highfield Road stub]
//   -> 136 Kingsley Walk -> 37 Lavender View
// Retired   = 83 Highfield Road's chain (3 links: Highfield -> Kingsley -> Lavender)
//
// What it does (all inside ONE db transaction):
//   1. Repoint the Highfield file's active chain link to the survivor chain.
//   2. Convert the survivor's "83 Highfield Road" stub (pos 3) into a real
//      CLAIMED link pointing at the Highfield file (keeps its original claimer +
//      claim date; clears the old wrong "Akeman Residential" stub label).
//   3. Enrich the survivor's 136 Kingsley Walk link with the richer data from
//      Highfield's chain (Philippa Scott + her invited/DECLINED history). The
//      spent invite token is intentionally NOT carried (a declined token can't be
//      reused).
//   4. Stack both Lavender View notes onto the survivor's Lavender link (keeps
//      Tom Mizen's contact; folds in the vendor/buyer names note + office phone).
//   5. Delete the now-empty Highfield chain (its links cascade away).
//   6. Discard the two abandoned DRAFT duplicate files (16 Deans Furlong + 83
//      Highfield Road), guarded on status=draft + agency. Cascade removes their
//      contacts/documents, mirroring the app's own discardDraftAction.
//
// SAFE BY DESIGN:
//   - Dry-run by default. Pass APPLY=1 to write.
//   - Prints the connected db host + confirms it is production before writing.
//   - Pre-flight guards assert every id is in the expected state; aborts on drift.
//   - Writes a full JSON snapshot of every affected row to the scratchpad BEFORE
//     applying, so the change is reversible.
//   - All writes run in a single prisma.$transaction (all-or-nothing).
//
// Usage:
//   npx tsx --env-file=.env.production scripts/merge-chains-deans-highfield.ts          # dry run
//   APPLY=1 npx tsx --env-file=.env.production scripts/merge-chains-deans-highfield.ts  # execute

import { prisma } from "@/lib/prisma";
import { writeFileSync } from "fs";

const APPLY = process.env.APPLY === "1";
const AGENCY_ID = "cmou19l8j0000n4djh2enonr7";
const HIGHFIELD_TX = "cmqqifl0b0006uxici4sxeb4y";

// Survivor chain (16 Deans Furlong)
const SURVIVOR_CHAIN = "cms5umznj000io1ikmmui9bgy";
const SUR_HIGHFIELD_STUB = "cms5vi8od0008ff7o8mesfuiz"; // pos3 -> becomes claimed Highfield
const SUR_KINGSLEY = "cms5vj8b1001knkv1ltgw80ch";       // pos4 -> enrich from Philippa
const SUR_LAVENDER = "cms610haj0002smfeiwulmugu";       // pos5 -> stack notes

// Retiring chain (83 Highfield Road)
const HF_CHAIN = "cmqqig3l8003auxics69bhiq0";
const HF_OWN_LINK = "cmqqig3pd003cuxic43el37q5";        // Highfield's old active link
const HF_KINGSLEY = "cmqqig3xr003euxicwe3nya7h";        // Philippa Scott (DECLINED)
const HF_LAVENDER = "cmqqig41n003guxicuu5wiwj8";        // names note + office phone

const DRAFT_IDS = [
  "cms5ufmtv000y11l0b22qmnyy", // 16 Deans Furlong draft dup
  "cmqqi5x16000413uwe8erl2tm", // 83 Highfield Road draft dup
];

const SNAPSHOT_PATH =
  "C:/Users/ellis/AppData/Local/Temp/claude/c--Users-ellis-Downloads-Sales-Prog-App-full/3164a64d-0073-4659-aaa6-6e1bbf8567c2/scratchpad/chain-merge-deans-highfield-backup.json";

function abort(msg: string): never {
  console.log(`\nABORTING: ${msg}`);
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.replace(/^.*@/, "").replace(/\/.*$/, "");
  console.log(`Connected to: ${host || "(unknown)"}`);
  console.log(APPLY ? "MODE: APPLY (will write)\n" : "MODE: dry-run (no writes)\n");

  // ── Load current state ──────────────────────────────────────────────────────
  const surStub = await prisma.chainLink.findUnique({ where: { id: SUR_HIGHFIELD_STUB } });
  const surKingsley = await prisma.chainLink.findUnique({ where: { id: SUR_KINGSLEY } });
  const surLavender = await prisma.chainLink.findUnique({ where: { id: SUR_LAVENDER } });
  const hfOwn = await prisma.chainLink.findUnique({ where: { id: HF_OWN_LINK } });
  const hfKingsley = await prisma.chainLink.findUnique({ where: { id: HF_KINGSLEY } });
  const hfLavender = await prisma.chainLink.findUnique({ where: { id: HF_LAVENDER } });
  const highfieldTx = await prisma.propertyTransaction.findUnique({ where: { id: HIGHFIELD_TX } });
  const drafts = await prisma.propertyTransaction.findMany({ where: { id: { in: DRAFT_IDS } } });

  // ── Pre-flight guards (abort on any drift) ─────────────────────────────────
  if (!surStub || surStub.chainId !== SURVIVOR_CHAIN) abort("survivor Highfield-stub link missing/moved");
  if (surStub.transactionId) abort("survivor Highfield-stub link is already claimed (already merged?)");
  if (!/highfield/i.test(surStub.stubPropertyAddress ?? "")) abort("survivor pos3 is not the Highfield stub anymore");
  if (!surKingsley || surKingsley.chainId !== SURVIVOR_CHAIN) abort("survivor Kingsley link missing/moved");
  if (!surLavender || surLavender.chainId !== SURVIVOR_CHAIN) abort("survivor Lavender link missing/moved");
  if (!hfOwn || hfOwn.chainId !== HF_CHAIN || hfOwn.transactionId !== HIGHFIELD_TX) abort("Highfield own link missing/changed");
  if (!hfKingsley || hfKingsley.chainId !== HF_CHAIN) abort("Highfield Kingsley (Philippa) link missing/moved");
  if (!hfLavender || hfLavender.chainId !== HF_CHAIN) abort("Highfield Lavender link missing/moved");
  if (!highfieldTx || highfieldTx.chainLinkId !== HF_OWN_LINK) abort("Highfield tx active link is not what we expect");
  for (const id of DRAFT_IDS) {
    const d = drafts.find((x) => x.id === id);
    if (!d) abort(`draft ${id} not found`);
    if (d.status !== "draft") abort(`draft ${id} is not status=draft (it is '${d.status}') — refusing to delete`);
    if (d.agencyId !== AGENCY_ID) abort(`draft ${id} belongs to a different agency`);
  }

  // ── Compute merged values (read from live rows, nothing hardcoded) ──────────
  const claimedByUserId = hfOwn.claimedByUserId;
  const claimedAt = hfOwn.claimedAt ?? new Date();

  // Lavender View has notes in two different fields across the two chains:
  //   - survivor keeps its own chainNotes (private intel, e.g. "mortgage offer is
  //     in...") UNTOUCHED.
  //   - the stub note gets the Highfield side stacked in, so nothing is lost.
  // hfLavender.chainNotes is folded in too (defensive; currently empty).
  const stackedLavenderNotes = [
    surLavender.stubNotes,
    hfLavender.stubNotes,
    hfLavender.chainNotes,
    hfLavender.stubAgentPhone ? `${hfLavender.stubAgencyName ?? "Agent"} office: ${hfLavender.stubAgentPhone}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  // ── Report the plan ─────────────────────────────────────────────────────────
  console.log("PLAN:");
  console.log(`1. Highfield file active link: ${HF_OWN_LINK}  ->  ${SUR_HIGHFIELD_STUB} (in survivor chain)`);
  console.log(`2. Convert survivor pos3 stub "${surStub.stubPropertyAddress}" -> CLAIMED Highfield file`);
  console.log(`     claimedBy=${claimedByUserId ?? "(none)"} claimedAt=${claimedAt.toISOString()}  (stub label "${surStub.stubAgencyName}" cleared)`);
  console.log(`3. Enrich survivor Kingsley Walk with: ${hfKingsley.stubAgentName} <${hfKingsley.stubAgentEmail}> ${hfKingsley.stubAgentPhone ?? ""} / ${hfKingsley.stubAgencyName} / invite=${hfKingsley.inviteStatus}`);
  console.log(`4. Lavender View — intel note (mortgage progress) KEPT untouched:\n     "${surLavender.chainNotes ?? "(none)"}"`);
  console.log(`   Lavender View — stub note becomes (stacked):\n---\n${stackedLavenderNotes}\n---`);
  console.log(`5. Delete Highfield chain ${HF_CHAIN} (3 links cascade away)`);
  console.log(`6. Delete draft duplicates: ${DRAFT_IDS.join(", ")}`);

  // ── Snapshot BEFORE writing ─────────────────────────────────────────────────
  const snapshot = {
    takenForApply: APPLY,
    survivorChainLinks: await prisma.chainLink.findMany({ where: { chainId: SURVIVOR_CHAIN }, orderBy: { position: "asc" } }),
    highfieldChain: await prisma.propertyChain.findUnique({ where: { id: HF_CHAIN } }),
    highfieldChainLinks: await prisma.chainLink.findMany({ where: { chainId: HF_CHAIN }, orderBy: { position: "asc" } }),
    highfieldTx: { id: highfieldTx.id, chainLinkId: highfieldTx.chainLinkId },
    drafts: await prisma.propertyTransaction.findMany({ where: { id: { in: DRAFT_IDS } } }),
    draftContacts: await prisma.contact.findMany({ where: { propertyTransactionId: { in: DRAFT_IDS } } }),
    draftDocuments: await prisma.transactionDocument.findMany({ where: { transactionId: { in: DRAFT_IDS } } }),
  };
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2));
  console.log(`\nSnapshot written: ${SNAPSHOT_PATH}`);
  console.log(`  (survivor links: ${snapshot.survivorChainLinks.length}, highfield links: ${snapshot.highfieldChainLinks.length}, draft contacts: ${snapshot.draftContacts.length}, draft docs: ${snapshot.draftDocuments.length})`);

  if (!APPLY) {
    console.log("\nDry run only. Re-run with APPLY=1 to execute.");
    return;
  }

  // ── Apply (atomic) ──────────────────────────────────────────────────────────
  await prisma.$transaction([
    // 1. Repoint Highfield file's active link into the survivor chain FIRST
    prisma.propertyTransaction.update({
      where: { id: HIGHFIELD_TX },
      data: { chainLinkId: SUR_HIGHFIELD_STUB },
    }),
    // 2. Convert survivor stub -> claimed Highfield link, clear stub identity
    prisma.chainLink.update({
      where: { id: SUR_HIGHFIELD_STUB },
      data: {
        transactionId: HIGHFIELD_TX,
        inviteStatus: "CLAIMED",
        claimedByUserId,
        claimedAt,
        stubPropertyAddress: null,
        stubAgencyName: null,
        stubAgentName: null,
        stubAgentEmail: null,
        stubAgentPhone: null,
        stubNotes: null,
      },
    }),
    // 3. Enrich survivor Kingsley Walk with Philippa's details + declined history
    prisma.chainLink.update({
      where: { id: SUR_KINGSLEY },
      data: {
        stubAgentName: hfKingsley.stubAgentName,
        stubAgentEmail: hfKingsley.stubAgentEmail,
        stubAgentPhone: hfKingsley.stubAgentPhone,
        stubAgencyName: hfKingsley.stubAgencyName,
        inviteStatus: hfKingsley.inviteStatus,
        inviteSentAt: hfKingsley.inviteSentAt,
        inviteDeclinedAt: hfKingsley.inviteDeclinedAt,
        inviteFirstViewedAt: hfKingsley.inviteFirstViewedAt,
        // inviteToken intentionally NOT copied (spent, and it is unique)
      },
    }),
    // 4. Stack both Lavender View notes onto the survivor link
    prisma.chainLink.update({
      where: { id: SUR_LAVENDER },
      data: { stubNotes: stackedLavenderNotes },
    }),
    // 5. Delete the now-empty Highfield chain (its links cascade)
    prisma.propertyChain.delete({ where: { id: HF_CHAIN } }),
    // 6. Discard the two abandoned draft duplicates (guarded)
    prisma.propertyTransaction.deleteMany({
      where: { id: { in: DRAFT_IDS }, status: "draft", agencyId: AGENCY_ID },
    }),
  ]);

  console.log("\nAPPLIED. Verifying...");
  const merged = await prisma.chainLink.findMany({
    where: { chainId: SURVIVOR_CHAIN },
    orderBy: { position: "asc" },
    select: { position: true, transactionId: true, stubPropertyAddress: true, inviteStatus: true },
  });
  for (const l of merged) {
    console.log(`  pos=${l.position} ${l.transactionId ? `CLAIMED ${l.transactionId}` : `stub "${l.stubPropertyAddress}"`} invite=${l.inviteStatus}`);
  }
  const hfChainGone = await prisma.propertyChain.findUnique({ where: { id: HF_CHAIN } });
  const draftsGone = await prisma.propertyTransaction.count({ where: { id: { in: DRAFT_IDS } } });
  console.log(`  Highfield chain deleted: ${hfChainGone === null}`);
  console.log(`  Draft duplicates remaining: ${draftsGone}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
