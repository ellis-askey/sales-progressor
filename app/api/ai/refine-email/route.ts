// POST /api/ai/refine-email  (critique 2026-10-05, composer phase 3)
//
// "Refine" in the email composer: neaten a draft's phrasing + grammar into the
// Sales Progressor voice WITHOUT changing its meaning, facts, names, dates,
// figures, recipients, links, greeting, or signature. It applies the sender's
// learned voice profile (the same one behind chase drafting), so over time the
// refinements sound more like what they actually send and approve.

import { NextRequest, NextResponse, after } from "next/server";
import { requireSession } from "@/lib/session";
import { getVoiceProfile, maybeRefreshVoiceProfile } from "@/lib/chase/voice-profile";
import { sanitizeChaseBodyHtml } from "@/lib/email/sanitize-signature";
import { checkAiLimit, rateLimitJson } from "@/lib/ratelimit";

function stripDashes(s: string): string {
  return s
    .replace(/(\d)\s*[—–]\s*(\d)/g, "$1-$2")
    .replace(/\s*[—–]+\s*/g, ", ")
    .replace(/,\s*,\s*/g, ", ");
}

export async function POST(req: NextRequest) {
  const session = await requireSession();

  const rate = await checkAiLimit(session.user.id).catch(() => ({ success: true, reset: 0, remaining: 30 }));
  if (!rate.success) return NextResponse.json(rateLimitJson(rate), { status: 429 });

  const { html } = await req.json().catch(() => ({ html: null }));
  if (!html || typeof html !== "string" || !html.trim()) {
    return NextResponse.json({ error: "Nothing to refine" }, { status: 400 });
  }
  if (html.length > 40_000) {
    return NextResponse.json({ error: "That email is too long to refine" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI service not configured" }, { status: 500 });

  const voiceProfile = await getVoiceProfile(session.user.id).catch(() => null);
  const voiceSection = voiceProfile
    ? `\n\n# How this person writes (match this voice closely)\n${voiceProfile}\n`
    : "";

  const systemPrompt = `You are an editor for a UK estate-agency sales progression service. You take a draft email an agent has written and refine it so it reads clearly, warmly and professionally, in plain British English. You never change what the email is actually saying.

Hard rules:
- Keep the same meaning, facts, names, dates, figures, recipients and links. Never invent information, promises or detail that isn't in the draft.
- Keep the structure: the same paragraphs and order. Keep the greeting line and the sign-off / signature block exactly as written.
- Fix grammar, spelling, clumsy phrasing, repetition and waffle. Make it concise and human, not stiff or corporate.
- British spelling. No em dashes or en dashes (use commas or full stops). No exclamation marks. No "the system"/"the platform"/"automatically" — write as a person.
- Return ONLY the refined email as simple HTML: <p> paragraphs, <br> for single line breaks, <strong>/<em>/<ul>/<ol>/<li>/<a> only where the draft already used them. No preamble, no commentary, no markdown code fences.${voiceSection}`;

  let out: string;
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: `Refine this email. Return only the refined HTML.\n\n${html}` }],
      }),
    });
    if (!resp.ok) {
      console.error("Claude refine error:", await resp.text());
      return NextResponse.json({ error: "Couldn't refine the email" }, { status: 500 });
    }
    const data = await resp.json();
    out = data.content?.[0]?.text ?? "";
  } catch (e) {
    console.error("[refine-email] request failed", e);
    return NextResponse.json({ error: "Couldn't refine the email" }, { status: 500 });
  }

  out = out.replace(/```html?/gi, "").replace(/```/g, "").trim();
  const refined = sanitizeChaseBodyHtml(stripDashes(out));
  if (!refined) return NextResponse.json({ error: "Couldn't refine the email" }, { status: 500 });

  // Learn out-of-band from what this agent sends/approves, so the next refine
  // sounds more like them. Never slows the response.
  after(() => maybeRefreshVoiceProfile(session.user.id).catch(() => {}));

  return NextResponse.json({ html: refined, voiceProfileApplied: voiceProfile != null });
}
