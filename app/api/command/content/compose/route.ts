import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { anthropic } from "@/lib/anthropic";
import { commandDb } from "@/lib/command/prisma";
import { PROMPT_VERSION } from "@/lib/command/content/prompts/system-prompt";
import { parseVariants } from "@/lib/command/content/prompts/draft-prompt";
import { buildComposeSystemPrompt, buildComposeUserMessage } from "@/lib/command/content/prompts/compose-prompt";
import { getBrandProfile, getBrandMemory } from "@/lib/command/content/brand";
import { getPurpose, getFormat } from "@/lib/command/content/create-taxonomy";
import { getChannelById } from "@/lib/command/content/channels";

// Guided-flow composer (docs/active/content-brand/SPEC.md, Phase 1.4). Generates
// a post ONLY after the source, purpose, angle, point and format are decided.
// Returns the same shape as /generate so the post step reuses DraftVariantPanel.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function claimNoteFor(claimClass: string | undefined): string | null {
  if (claimClass === "unverified") return "The core claim is unverified. Do not state it as fact; frame it as an observation or a question, or leave it out.";
  if (claimClass === "inference") return "The core claim is an inference, not a proven fact. Hedge it accordingly.";
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { source, purposeId, angleLabel, point, formatId, inboxItemId } = body as {
    source: string; purposeId: string; angleLabel: string; point: string; formatId: string; inboxItemId?: string;
  };

  if (!source?.trim() || !purposeId || !point?.trim() || !formatId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const purpose = getPurpose(purposeId);
  const format = getFormat(formatId);
  if (!purpose || !format) {
    return NextResponse.json({ error: "Invalid purpose or format" }, { status: 400 });
  }
  const channel = getChannelById(format.channelId);
  if (!channel) {
    return NextResponse.json({ error: "Invalid channel for format" }, { status: 400 });
  }

  // Ground evidence + claim honesty server-side from the source inbox item, so
  // the client can't loosen the claim caution.
  const item = inboxItemId
    ? await commandDb.contentInboxItem.findUnique({ where: { id: inboxItemId } })
    : null;
  const evidenceText = item?.evidence ? JSON.stringify(item.evidence) : null;
  const claimNote = claimNoteFor(item?.claimClass);

  const [profile, memory] = await Promise.all([getBrandProfile(), getBrandMemory()]);
  const systemPrompt = await buildComposeSystemPrompt(profile, memory);
  const userMessage = buildComposeUserMessage(
    {
      source: source.trim(),
      purposeLabel: purpose.label,
      purposeHint: purpose.hint,
      angleLabel: angleLabel || "Straight",
      point: point.trim(),
      formatLabel: format.label,
      formatNote: format.note,
      evidence: evidenceText,
      claimNote,
    },
    channel,
  );

  const MODEL = "claude-haiku-4-5-20251001";
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const rawText = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
  const { variant1, variant2 } = parseVariants(rawText);
  if (!variant1) {
    return NextResponse.json({ error: "Generation failed. No content returned." }, { status: 500 });
  }

  const draft = await commandDb.draftPost.create({
    data: {
      channel: format.channelId,
      tone: purposeId,
      topicSeed: point.trim(),
      sourceType: item?.sourceType ?? "manual",
      prompt: userMessage,
      aiModel: MODEL,
      aiPromptVersion: PROMPT_VERSION,
      variant1,
      variant2,
      aiTokensInput: msg.usage.input_tokens,
      aiTokensOutput: msg.usage.output_tokens,
    },
  });

  // Link back to the inbox item + close the loop on its source thought.
  if (item) {
    await commandDb.contentInboxItem.update({
      where: { id: item.id },
      data: { status: "explored", decidedAt: new Date(), draftPostId: draft.id },
    }).catch(() => {});
    if (item.sourceThoughtId) {
      await commandDb.ellisThought.update({ where: { id: item.sourceThoughtId }, data: { status: "used" } }).catch(() => {});
    }
  }

  return NextResponse.json({ draftId: draft.id, variant1, variant2, charLimit: channel.charLimit });
}
