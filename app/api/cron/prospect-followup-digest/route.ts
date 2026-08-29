import { NextRequest, NextResponse } from "next/server";
import { runJob } from "@/lib/cron/run-job";
import { sendEmail } from "@/lib/email";
import { getFollowUpCounts, getFollowUpQueue } from "@/lib/command/prospects";

// Runs 07:30 weekdays via Vercel Cron (see vercel.json), just before the agent
// morning digest. Protected by CRON_SECRET.
//
// A single reminder to Ellis when prospect follow-ups are due to be actioned.
// This does NOT send anything to prospects — outreach stays fully manual. It
// only nudges the operator to open the Follow-ups queue and work it. Silent on
// days with nothing due, so it never becomes noise.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("prospect-followup-digest", async () => {
    const counts = await getFollowUpCounts();
    const due = counts.today + counts.overdue;
    if (due === 0) return NextResponse.json({ sent: 0, reason: "nothing due" });

    const [overdue, today] = await Promise.all([getFollowUpQueue("overdue"), getFollowUpQueue("today")]);
    const rows = [...overdue, ...today].slice(0, 12);
    const now = Date.now();
    const lines = rows.map((r) => {
      const tag = r.dueDate.getTime() < now ? " · overdue" : "";
      return `- ${r.agencyName}${r.primaryContactName ? ` · ${r.primaryContactName}` : ""}${tag}`;
    });
    const remainder = due - rows.length;

    const to = process.env.PROSPECT_DIGEST_TO ?? "ellis@thesalesprogressor.co.uk";
    const link = "https://portal.thesalesprogressor.co.uk/command/prospects?view=followups";

    const text = [
      `You have ${due} prospect follow-up${due === 1 ? "" : "s"} ready to action${counts.overdue ? ` (${counts.overdue} overdue)` : ""}.`,
      "",
      ...lines,
      remainder > 0 ? `...and ${remainder} more.` : "",
      "",
      `Open your follow-ups: ${link}`,
      "",
      "Nothing has been sent to anyone. This is just your reminder to work the queue.",
    ].filter((l) => l !== "").join("\n");

    await sendEmail({
      to,
      subject: `${due} prospect follow-up${due === 1 ? "" : "s"} ready${counts.overdue ? ` (${counts.overdue} overdue)` : ""}`,
      text,
    });

    return NextResponse.json({ sent: 1, due, overdue: counts.overdue, today: counts.today });
  });
}
