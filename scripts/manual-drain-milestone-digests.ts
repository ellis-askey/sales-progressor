// Manually invoke the milestone-digest drain. Confirms whether the drain
// logic + SendGrid path work end-to-end without depending on the Vercel
// cron infrastructure. If this script sends the emails successfully,
// the bug is in cron registration / authorisation, not in the code.

import { drainMilestoneDigests } from "@/lib/email/milestone-digest-drain";

async function main() {
  console.log("Manually invoking drainMilestoneDigests()...\n");
  const result = await drainMilestoneDigests();
  console.log("RESULT:", JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error("FATAL", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
