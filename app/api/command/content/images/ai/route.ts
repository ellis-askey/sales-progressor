import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { commandDb } from "@/lib/command/prisma";
import {
  getMonthlyAiImageSpendPence,
  getMonthlyCapPence,
  moderateImagePrompt,
} from "@/lib/command/content/image-budget";

// ~5p per image (conservative; actual FLUX.1-schnell is ~0.3–0.5p)
const COST_PER_IMAGE_PENCE = 5;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    prompt?: string;
    variant?: string;
    draftPostId?: string;
  };

  const prompt = (body.prompt ?? "").trim();
  const variant = body.variant ?? "auto";
  const draftPostId = body.draftPostId ?? null;

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (prompt.length > 400) {
    return NextResponse.json({ error: "Prompt too long (max 400 chars)" }, { status: 400 });
  }

  // Prompt moderation
  const mod = moderateImagePrompt(prompt);
  if (!mod.ok) {
    return NextResponse.json({ error: mod.reason }, { status: 422 });
  }

  // Budget check
  const [spent, cap] = await Promise.all([
    getMonthlyAiImageSpendPence(),
    Promise.resolve(getMonthlyCapPence()),
  ]);
  if (spent + COST_PER_IMAGE_PENCE > cap) {
    return NextResponse.json(
      { error: `Monthly AI image budget reached (£${(cap / 100).toFixed(2)}). Resets on the 1st.` },
      { status: 429 }
    );
  }

  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    return NextResponse.json({ error: "REPLICATE_API_TOKEN not configured" }, { status: 500 });
  }

  // Build full prompt with style guidance
  const stylePrefix =
    variant === "light"
      ? "clean professional photograph, bright natural lighting, minimal background, "
      : "moody professional photograph, dark atmospheric background, dramatic lighting, ";
  const fullPrompt = `${stylePrefix}${prompt}, no people, no faces, no text, photorealistic`;

  const replicate = new Replicate({ auth: apiToken });

  let url: string;
  try {
    const output = await replicate.run("black-forest-labs/flux-schnell", {
      input: {
        prompt: fullPrompt,
        aspect_ratio: "16:9",
        output_format: "webp",
        output_quality: 85,
        num_outputs: 1,
        num_inference_steps: 4,
        go_fast: true,
      },
    });

    const urls = output as string[];
    if (!urls?.[0]) throw new Error("No output from Replicate");
    url = urls[0];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Store record
  const record = await commandDb.generatedImage.create({
    data: {
      imageType: "ai_generated",
      variant,
      prompt,
      url,
      width: 1200,
      height: 628,
      aiModel: "flux-schnell",
      aiCostCents: COST_PER_IMAGE_PENCE,
      draftPostId,
    },
  });

  return NextResponse.json({ url, imageId: record.id });
}
