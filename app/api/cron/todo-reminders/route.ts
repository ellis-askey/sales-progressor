import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildFrom } from "@/lib/email/from-name";
import { notify } from "@/lib/todo/service";

// Boardwalk To Do reminder dispatcher. Runs every 5 minutes via Vercel Cron
// (vercel.json) — reminders fire whether or not anyone has a browser open.
// Idempotent: each reminder is claimed by setting sentAt BEFORE sending, so
// an overlapping run can never deliver it twice; a failed email is logged
// but the in-app notification has already landed.
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await prisma.todoReminder.findMany({
    where: { sentAt: null, remindAt: { lte: new Date() } },
    take: 100,
    orderBy: { remindAt: "asc" },
  });

  let sent = 0;
  for (const reminder of due) {
    // Claim first — a concurrent run that loses this race skips the row.
    const claimed = await prisma.todoReminder.updateMany({
      where: { id: reminder.id, sentAt: null },
      data: { sentAt: new Date() },
    });
    if (!claimed.count) continue;

    const task = await prisma.todoTask.findUnique({ where: { id: reminder.taskId } });
    if (!task || task.completedAt) continue;
    const user = await prisma.formTenantUser.findUnique({
      where: { id: reminder.userId },
      include: { tenant: { select: { name: true } } },
    });
    if (!user) continue;

    await notify({
      tenantId: task.tenantId,
      userId: user.id,
      type: "reminder",
      message: `Reminder: "${task.title}"${task.dueTime ? ` at ${task.dueTime}` : ""}`,
      taskId: task.id,
    });

    try {
      const url = `${process.env.NEXTAUTH_URL || ""}/boardwalk/todo/today`;
      await sendEmail({
        to: user.email,
        subject: `Reminder: ${task.title}`,
        text: `A reminder from ${user.tenant.name} To Do:\n\n${task.title}${task.dueDate ? `\nDue ${task.dueDate.toISOString().slice(0, 10)}${task.dueTime ? ` at ${task.dueTime}` : ""}` : ""}\n\nOpen your tasks: ${url}`,
        from: buildFrom(`${user.tenant.name} To Do`),
        emailType: "todo_reminder",
      });
    } catch (err) {
      console.error("[todo-reminders] email failed", err);
    }
    sent++;
  }

  return NextResponse.json({ success: true, processed: due.length, sent });
}
