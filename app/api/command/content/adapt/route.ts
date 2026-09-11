import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { anthropic } from "@/lib/anthropic";
import { commandDb } from "@/lib/command/prisma";
import { getBrandProfile, getBrandMemory } from "@/lib/command/content/brand";
import { buildAdaptSystemPrompt, buildAdaptUserMessage, parseAdaptations } from "@/lib/command/content/prompts/adapt-prompt";

// Platform adaptation (docs/active/content-brand/SPEC.md, Phase 4.1). Turns one
// core post into LinkedIn / Instagram / Facebook versions and persists them
// (one row per draft+platform) so later publishing can use the right text.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5-20251001";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { draftId, text } = body as { draftId?: string; text: string };
  if (!text?.trim()) return NextResponse.json({ error: "Missing text" }, { status: 400 });

  const [profile, memory] = await Promise.all([getBrandProfile(), getBrandMemory()]);
  const systemPrompt = await buildAdaptSystemPrompt(profile, memory);

  let raw: string;
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: buildAdaptUserMessage(text.trim()) }],
    });
    raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
  } catch {
    return NextResponse.json({ error: "Adaptation failed right now." }, { status: 500 });
  }

  const adaptations = parseAdaptations(raw);
  if (adaptations.length === 0) return NextResponse.json({ error: "No adaptations returned." }, { status: 500 });

  // Persist when we have a draft to attach them to. Best-effort; a failed write
  // shouldn't lose the result on screen.
  if (draftId) {
    for (const a of adaptations) {
      await commandDb.postAdaptation.upsert({
        where: { draftPostId_platform: { draftPostId: draftId, platform: a.platform } },
        create: { draftPostId: draftId, platform: a.platform, treatment: a.treatment, text: a.text, mediaHint: a.mediaHint },
        update: { treatment: a.treatment, text: a.text, mediaHint: a.mediaHint },
      }).catch(() => {});
    }
  }

  return NextResponse.json({ adaptations });
}
