import { NextRequest, NextResponse } from "next/server";
import { runJob } from "@/lib/cron/run-job";
import { sendEmail } from "@/lib/email";
import { getFollowUpCounts, getFollowUpQueue, getReadyFlowSteps } from "@/lib/command/prospects";

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
    const readySteps = await getReadyFlowSteps();
    const readyCount = readySteps.length;
    if (due === 0 && readyCount === 0) return NextResponse.json({ sent: 0, reason: "nothing due" });

    const [overdue, today] = await Promise.all([getFollowUpQueue("overdue"), getFollowUpQueue("today")]);
    const rows = [...overdue, ...today].slice(0, 12);
    const now = Date.now();
    const lines = rows.map((r) => {
      const tag = r.dueDate.getTime() < now ? " · overdue" : "";
      return `- ${r.agencyName}${r.primaryContactName ? ` · ${r.primaryContactName}` : ""}${tag}`;
    });
    const remainder = due - rows.length;

    const flowLines = readySteps.slice(0, 12).map((s) => `- ${s.agencyName} · ${s.stepLabel} email`);
    const flowRemainder = readyCount - Math.min(readyCount, 12);

    const to = process.env.PROSPECT_DIGEST_TO ?? "ellis@thesalesprogressor.co.uk";
    const link = "https://portal.thesalesprogressor.co.uk/command/prospects?view=followups";

    const sections: string[] = [];
    if (due > 0) {
      sections.push([
        `You have ${due} prospect follow-up${due === 1 ? "" : "s"} ready to action${counts.overdue ? ` (${counts.overdue} overdue)` : ""}.`,
        ...lines,
        remainder > 0 ? `...and ${remainder} more.` : "",
      ].filter(Boolean).join("\n"));
    }
    if (readyCount > 0) {
      sections.push([
        `${readyCount} flow email${readyCount === 1 ? "" : "s"} ready for you to approve:`,
        ...flowLines,
        flowRemainder > 0 ? `...and ${flowRemainder} more.` : "",
      ].filter(Boolean).join("\n"));
    }
    sections.push(`Open your prospects: ${link}`);
    sections.push("Nothing has been sent to anyone. This is your reminder to work the queue and approve any flow emails.");

    const subjectBits: string[] = [];
    if (due > 0) subjectBits.push(`${due} follow-up${due === 1 ? "" : "s"}`);
    if (readyCount > 0) subjectBits.push(`${readyCount} to approve`);

    await sendEmail({
      to,
      subject: `Prospects: ${subjectBits.join(", ")}${counts.overdue ? ` (${counts.overdue} overdue)` : ""}`,
      text: sections.join("\n\n"),
    });

    return NextResponse.json({ sent: 1, due, overdue: counts.overdue, today: counts.today, ready: readyCount });
  });
}
