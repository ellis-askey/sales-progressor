import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { commandDb } from "@/lib/command/prisma";
import { anthropic } from "@/lib/anthropic";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Gather recent milestone completions
  const recentCompletions = await prisma.milestoneCompletion.findMany({
    where: { completedAt: { gte: sevenDaysAgo }, state: "complete" },
    select: {
      milestoneDefinition: { select: { name: true, side: true } },
    },
    take: 60,
    orderBy: { completedAt: "desc" },
  });

  // Transaction status summary
  const txnGroups = await prisma.propertyTransaction.groupBy({
    by: ["status"],
    _count: { id: true },
    where: { status: { in: ["active", "on_hold"] } },
  });

  // How many pending topics already in queue
  const existingPending = await commandDb.contentTopic.count({
    where: { status: "pending", source: "activity_derived" },
  });

  // Don't flood the queue — skip if 3+ activity-derived topics already pending
  if (existingPending >= 3) {
    return NextResponse.json({ ok: true, skipped: true, reason: "queue_sufficient" });
  }

  if (recentCompletions.length === 0 && txnGroups.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no_activity" });
  }

  // Build a summary for Claude
  const milestoneSummary = recentCompletions
    .reduce<Record<string, number>>((acc, c) => {
      const md = c.milestoneDefinition;
      const key = `${md.side}: ${md.name}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

  const milestoneLines = Object.entries(milestoneSummary)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([k, v]) => `  - ${k} (${v}×)`)
    .join("\n");

  const txnLines = txnGroups
    .map((g) => `  - ${g.status}: ${g._count.id} transactions`)
    .join("\n");

  const activitySummary = [
    milestoneLines ? `Milestone completions in the last 7 days:\n${milestoneLines}` : "",
    txnLines ? `Current transaction pipeline:\n${txnLines}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const systemPrompt = `You are a content strategist for Sales Progressor, a UK estate agency SaaS product.

Sales Progressor's core thesis: UK property sales fail because of silence — between solicitors, agents, and clients. The product ends that silence with structured milestones, automated updates, and live visibility.

Your job is to look at real activity data from the past 7 days and suggest 2–3 LinkedIn post topics that the founder could write about. Topics should connect to specific, real patterns in the data — not generic advice.

Return a JSON array only. No markdown, no commentary. Format:
[
  { "text": "topic idea in one sentence", "channelHint": "linkedin" },
  ...
]`;

  const userMessage = `Here is the activity data from the past 7 days:\n\n${activitySummary}\n\nSuggest 2–3 LinkedIn post topics that connect specifically to these patterns. Return JSON array only.`;

  let topics: Array<{ text: string; channelHint?: string }> = [];

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    topics = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch {
    return NextResponse.json({ ok: false, error: "Claude call failed" }, { status: 500 });
  }

  if (!Array.isArray(topics) || topics.length === 0) {
    return NextResponse.json({ ok: true, created: 0, reason: "no_topics_returned" });
  }

  const validTopics = topics.filter(
    (t) => typeof t === "object" && typeof t.text === "string" && t.text.trim()
  );

  await commandDb.contentTopic.createMany({
    data: validTopics.map((t) => ({
      text: t.text.trim(),
      source: "activity_derived",
      channelHint: t.channelHint === "linkedin" ? ("linkedin" as const) : undefined,
    })),
  });

  return NextResponse.json({ ok: true, created: validTopics.length });
}
