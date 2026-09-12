import { NextRequest, NextResponse } from "next/server";
import { runRiskHistorySweep } from "@/lib/services/risk-history";
import { runJob } from "@/lib/cron/run-job";

// Change-only risk-history sweep (Data Optionality capture-now, PR5). Sibling of
// detect-problems on the same 03:00 slot. Capture-only: appends
// TransactionRiskHistory rows; drives no product behaviour. Observability via
// JobRun (runJob).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("risk-history", async () => {
    const rowsWritten = await runRiskHistorySweep();
    return NextResponse.json({ ok: true, rowsWritten });
  });
}
