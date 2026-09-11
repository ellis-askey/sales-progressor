import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { anthropic } from "@/lib/anthropic";
import { getBrandProfile, getBrandMemory } from "@/lib/command/content/brand";
import { buildComposeSystemPrompt } from "@/lib/command/content/prompts/compose-prompt";

// Media treatment suggestion (docs/active/content-brand/SPEC.md, Phase 4.2).
// Recommends the single best visual treatment for a post and a branded-card
// headline, so the composer can preview it and hand off to the image studio.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5-20251001";
const VALID = new Set(["text", "static", "carousel", "screenshot", "data_graphic", "short_video"]);

function parse(raw: string): { treatment?: string; headline?: string; brief?: string } {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a === -1 || b === -1) return {};
  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { text } = (await req.json()) as { text: string };
  if (!text?.trim()) return NextResponse.json({ error: "Missing text" }, { status: 400 });

  const [profile, memory] = await Promise.all([getBrandProfile(), getBrandMemory()]);
  const systemPrompt = await buildComposeSystemPrompt(profile, memory);

  const user = `For this post, recommend the single best visual treatment and a headline for a branded card.\n"""\n${text.trim()}\n"""\n\nTreatment is one of: text (a short statement card), static (a branded image), carousel (multi-slide), screenshot (a product screenshot), data_graphic (a chart or number), short_video. Prefer text or data_graphic when the point is a statement or a number. The headline must be short enough to sit on a card (roughly 12 words or fewer) and must not invent a figure. Respond with STRICT JSON only, no code fence:\n{ "treatment": "...", "headline": "...", "brief": "one line on what the visual should show" }`;

  let raw: string;
  try {
    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 400, system: systemPrompt, messages: [{ role: "user", content: user }] });
    raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
  } catch {
    return NextResponse.json({ error: "Could not suggest a visual right now." }, { status: 500 });
  }

  const p = parse(raw);
  const treatment = p.treatment && VALID.has(p.treatment) ? p.treatment : "text";
  const headline = typeof p.headline === "string" ? p.headline.trim() : "";
  const brief = typeof p.brief === "string" ? p.brief.trim() : "";
  if (!headline && !brief) return NextResponse.json({ error: "No suggestion returned." }, { status: 500 });

  return NextResponse.json({ treatment, headline, brief });
}
