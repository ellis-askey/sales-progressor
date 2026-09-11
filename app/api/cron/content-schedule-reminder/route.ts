import { NextRequest, NextResponse } from "next/server";
import { commandDb } from "@/lib/command/prisma";
import { sendEmail } from "@/lib/email";

// Scheduled-post reminder (docs/active/content-brand/SPEC.md, Phase 5.1). "Scheduled"
// means prepared + reminded, not auto-published. This emails a digest of posts
// due today so Ellis can post them. Guarded by CRON_SECRET.
//
// NOTE: not registered in vercel.json yet (Vercel Hobby daily-cron limit); see
// docs/active/ELLIS_MANUAL_TODO.md. Until scheduled, it can be run on demand.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const REMINDER_TO = process.env.CONTENT_REMINDER_TO || "inbox@thesalesprogressor.co.uk";

function textOf(d: { editedText: string | null; variant1: string; variant2: string; chosenVariant: number | null }): string {
  return (d.editedText || (d.chosenVariant === 2 ? d.variant2 : d.variant1) || "").trim();
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const due = await commandDb.draftPost.findMany({
    where: { posted: false, scheduleStatus: "scheduled", scheduledFor: { lte: endOfDay } },
    orderBy: { scheduledFor: "asc" },
    take: 25,
    select: { id: true, channel: true, editedText: true, variant1: true, variant2: true, chosenVariant: true },
  });

  if (due.length === 0) return NextResponse.json({ ok: true, due: 0 });

  const lines = due.map((d) => {
    const t = textOf(d);
    return `• [${d.channel}] ${t.slice(0, 120)}${t.length > 120 ? "…" : ""}`;
  });

  const text = `You have ${due.length} post${due.length === 1 ? "" : "s"} due to publish today:\n\n${lines.join("\n\n")}\n\nOpen the calendar: /command/content/calendar`;

  await sendEmail({
    to: REMINDER_TO,
    subject: `${due.length} post${due.length === 1 ? "" : "s"} to publish today`,
    text,
    html: `<p>You have ${due.length} post${due.length === 1 ? "" : "s"} due to publish today.</p><ul>${due.map((d) => `<li>[${d.channel}] ${textOf(d).slice(0, 120)}</li>`).join("")}</ul><p><a href="https://portal.thesalesprogressor.co.uk/command/content/calendar">Open the calendar</a></p>`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, due: due.length });
}
