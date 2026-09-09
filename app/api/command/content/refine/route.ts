import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { anthropic } from "@/lib/anthropic";
import { buildComposeSystemPrompt } from "@/lib/command/content/prompts/compose-prompt";
import { getBrandProfile, getBrandMemory } from "@/lib/command/content/brand";
import {
  getRefineAction,
  PROMO_INTENSITY_INSTRUCTION,
  type PromoIntensity,
} from "@/lib/command/content/refine-actions";

// Composer refine (docs/active/content-brand/SPEC.md, Phase 3.1). Applies one
// targeted rewrite to the current draft, or explains what changed. Same voice +
// brand + anti-AI grounding as the composer, so refinements stay on-voice.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5-20251001";
const VALID_INTENSITY = new Set(["low", "medium", "high"]);

function parseJson(raw: string): { revised?: string; changed?: string } {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { text, action, promotionalIntensity, baseline } = body as {
    text: string; action: string; promotionalIntensity?: string; baseline?: string;
  };
  if (!text?.trim() || !action) {
    return NextResponse.json({ error: "Missing text or action" }, { status: 400 });
  }

  const [profile, memory] = await Promise.all([getBrandProfile(), getBrandMemory()]);
  const systemPrompt = await buildComposeSystemPrompt(profile, memory);

  // Explain-what-changed: a read, not a rewrite.
  if (action === "explain_changes") {
    const user = `Here is the original draft:\n"""\n${baseline ?? ""}\n"""\n\nHere is the current draft:\n"""\n${text}\n"""\n\nIn one or two plain sentences, explain what changed between them and why it reads differently. If they are essentially the same, say so. Respond with the explanation only, no preamble.`;
    let explanation = "";
    try {
      const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 300, system: systemPrompt, messages: [{ role: "user", content: user }] });
      explanation = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    } catch {
      return NextResponse.json({ error: "Could not explain changes right now." }, { status: 500 });
    }
    return NextResponse.json({ revised: text, changed: explanation });
  }

  const refine = getRefineAction(action);
  if (!refine) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const intensity: PromoIntensity = VALID_INTENSITY.has(promotionalIntensity ?? "") ? (promotionalIntensity as PromoIntensity) : "low";

  const user = `Here is the current draft of a social post:\n"""\n${text}\n"""\n\nApply this change: ${refine.instruction}\n\n${PROMO_INTENSITY_INSTRUCTION[intensity]}\n\nKeep it on Ellis's voice and within the same rough length unless the change is specifically to shorten it. Respond with STRICT JSON only, no code fence:\n{ "revised": "the full revised post", "changed": "one short line on what you changed" }`;

  let revised = "";
  let changed = "";
  try {
    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 2048, system: systemPrompt, messages: [{ role: "user", content: user }] });
    const raw = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    const parsed = parseJson(raw);
    revised = (parsed.revised ?? "").trim() || raw; // fall back to the raw text if JSON was skipped
    changed = (parsed.changed ?? "").trim() || refine.label;
  } catch {
    return NextResponse.json({ error: "Refine failed right now." }, { status: 500 });
  }

  if (!revised) return NextResponse.json({ error: "No revision returned." }, { status: 500 });
  return NextResponse.json({ revised, changed });
}
