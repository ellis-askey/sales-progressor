"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { commandDb } from "@/lib/command/prisma";

async function assertSuperadmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    throw new Error("Unauthorised");
  }
}

// Minimum total engagement to trigger a "revisit this angle" topic signal
const SIGNAL_THRESHOLD = 5;

export async function logEngagementAction(formData: FormData): Promise<void> {
  await assertSuperadmin();

  const draftPostId = formData.get("draftPostId") as string;
  const likes = Math.max(0, Number(formData.get("likes") ?? 0));
  const comments = Math.max(0, Number(formData.get("comments") ?? 0));
  const shares = Math.max(0, Number(formData.get("shares") ?? 0));
  const impressionsRaw = formData.get("impressions");
  const clicksRaw = formData.get("clicks");
  const notes = (formData.get("notes") as string ?? "").trim();

  if (!draftPostId) return;

  const draft = await commandDb.draftPost.findUnique({ where: { id: draftPostId } });
  if (!draft) return;

  await commandDb.contentEngagement.upsert({
    where: { draftPostId },
    create: {
      draftPostId,
      channel: draft.channel,
      likes,
      comments,
      shares,
      impressions: impressionsRaw ? Number(impressionsRaw) : null,
      clicks: clicksRaw ? Number(clicksRaw) : null,
      notes: notes || null,
    },
    update: {
      likes,
      comments,
      shares,
      impressions: impressionsRaw ? Number(impressionsRaw) : null,
      clicks: clicksRaw ? Number(clicksRaw) : null,
      notes: notes || null,
    },
  });

  // Performance signal: if engagement is strong, queue a follow-up topic
  const totalEngagement = likes + comments + shares;
  if (totalEngagement >= SIGNAL_THRESHOLD) {
    const followUpText = `This angle performed well (${totalEngagement} total engagements) — revisit or expand: "${draft.topicSeed.slice(0, 100)}"`;
    const existing = await commandDb.contentTopic.findFirst({
      where: { text: { contains: draft.topicSeed.slice(0, 40) }, status: "pending" },
    });
    if (!existing) {
      await commandDb.contentTopic.create({
        data: {
          text: followUpText,
          source: "activity_derived",
          channelHint: draft.channel,
          priority: 2, // elevated — earned by performance data
          status: "pending",
        },
      });
    }
  }

  redirect("/command/content");
}
