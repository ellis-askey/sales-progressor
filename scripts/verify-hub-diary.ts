// Verify the post-fix getHubDiary returns no items for the three
// prod files that have expectedExchangeDate set to a stale 12-week
// placeholder.
import { PrismaClient } from "@prisma/client";
import { getHubDiary } from "@/lib/services/hub";
const p = new PrismaClient();

(async () => {
  // Build a wide-open AgentVisibility that sees everything across all
  // agencies (admin-style). The real call sites build this via
  // resolveAgentVisibility / resolveInternalVisibility; here we
  // construct it manually for the verify pass.
  const items = await getHubDiary({
    userId: "verify-script",
    agencyId: "",
    seeAll: false,
    firmName: null,
    internalMode: "admin_all",
  });
  console.log(`Diary items today: ${items.length}`);
  for (const item of items) console.log(`  ${item.type.padEnd(11)} ${item.address}`);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
