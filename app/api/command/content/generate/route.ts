import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { anthropic } from "@/lib/anthropic";
import { commandDb } from "@/lib/command/prisma";
import { buildSystemPrompt, PROMPT_VERSION } from "@/lib/command/content/prompts/system-prompt";
import { buildDraftUserMessage, parseVariants } from "@/lib/command/content/prompts/draft-prompt";
import { getToneById } from "@/lib/command/content/tones";
import { getChannelById } from "@/lib/command/content/channels";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { channel: channelId, toneId, topic, topicId, regenerateDraftId } = body as {
    channel: string;
    toneId: string;
    topic: string;
    topicId?: string;
    regenerateDraftId?: string;
  };

  if (!channelId || !toneId || !topic?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const channel = getChannelById(channelId);
  const tone = getToneById(toneId);

  if (!channel || !tone) {
    return NextResponse.json({ error: "Invalid channel or tone" }, { status: 400 });
  }

  const [systemPrompt, userMessage] = await Promise.all([
    buildSystemPrompt(),
    Promise.resolve(buildDraftUserMessage(topic.trim(), tone, channel)),
  ]);

  const MODEL = "claude-haiku-4-5-20251001";

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const rawText =
    msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";

  const { variant1, variant2 } = parseVariants(rawText);

  if (!variant1) {
    return NextResponse.json({ error: "Generation failed — no content returned" }, { status: 500 });
  }

  const tokensIn = msg.usage.input_tokens;
  const tokensOut = msg.usage.output_tokens;

  const sourceType = topicId ? "activity_derived" : "manual";

  let draft;
  if (regenerateDraftId) {
    draft = await commandDb.draftPost.update({
      where: { id: regenerateDraftId },
      data: {
        variant1,
        variant2,
        regenerationCount: { increment: 1 },
        editedText: null,
        chosenVariant: null,
        aiTokensInput: tokensIn,
        aiTokensOutput: tokensOut,
      },
    });
  } else {
    draft = await commandDb.draftPost.create({
      data: {
        channel: channelId as never,
        tone: toneId,
        topicSeed: topic.trim(),
        sourceType,
        prompt: userMessage,
        aiModel: MODEL,
        aiPromptVersion: PROMPT_VERSION,
        variant1,
        variant2,
        aiTokensInput: tokensIn,
        aiTokensOutput: tokensOut,
        topicId: topicId ?? null,
      },
    });

    // Mark source topic as used
    if (topicId) {
      await commandDb.contentTopic.update({
        where: { id: topicId },
        data: { status: "used", usedAt: new Date(), draftPostId: draft.id },
      }).catch(() => {});
    }
  }

  return NextResponse.json({ draftId: draft.id, variant1, variant2 });
}
