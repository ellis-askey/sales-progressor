// lib/services/email-parse.ts
// Parses an inbound email text using Claude AI and matches it to open milestones.

export type MilestoneSuggestion = {
  milestoneId: string;
  milestoneCode: string;
  milestoneName: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};

export type EmailParseResult = {
  suggestions: MilestoneSuggestion[];
  extractedSummary: string;
  senderClue: string | null;
  noMatch: boolean;
};

export async function parseEmailForMilestones(
  emailText: string,
  openMilestones: Array<{ id: string; code: string; name: string; side: string }>
): Promise<EmailParseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const milestoneList = openMilestones
    .map((m) => `- ${m.code}: "${m.name}" (${m.side} side)`)
    .join("\n");

  const prompt = `You are a UK residential property conveyancing expert. An estate agent has received an email relating to a property transaction and needs to know if it confirms completion of any outstanding milestones.

OPEN MILESTONES (not yet completed):
${milestoneList}

EMAIL CONTENT:
---
${emailText.slice(0, 3000)}
---

Analyse the email and:
1. Identify which open milestones (if any) are confirmed as complete by this email. Only match if clearly evidenced in the email text.
2. Extract a one-sentence summary of what the email says.
3. Identify the likely sender's role (e.g. "vendor's solicitor", "purchaser's broker", "unknown").

Respond in JSON only, no explanation:
{
  "suggestions": [
    {
      "milestoneCode": "PM9",
      "confidence": "high",
      "reason": "Email states searches have been ordered"
    }
  ],
  "extractedSummary": "Vendor's solicitor confirms draft contract pack has been issued.",
  "senderClue": "vendor's solicitor",
  "noMatch": false
}

If no milestones match, return "noMatch": true and empty suggestions array.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error("Claude API error");

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? "{}";

  let parsed: {
    suggestions?: Array<{ milestoneCode: string; confidence: string; reason: string }>;
    extractedSummary?: string;
    senderClue?: string | null;
    noMatch?: boolean;
  } = {};

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    return { suggestions: [], extractedSummary: "", senderClue: null, noMatch: true };
  }

  const suggestions: MilestoneSuggestion[] = (parsed.suggestions ?? [])
    .map((s) => {
      const milestone = openMilestones.find((m) => m.code === s.milestoneCode);
      if (!milestone) return null;
      return {
        milestoneId: milestone.id,
        milestoneCode: milestone.code,
        milestoneName: milestone.name,
        confidence: (s.confidence as MilestoneSuggestion["confidence"]) ?? "low",
        reason: s.reason ?? "",
      };
    })
    .filter((s): s is MilestoneSuggestion => s !== null);

  return {
    suggestions,
    extractedSummary: parsed.extractedSummary ?? "",
    senderClue: parsed.senderClue ?? null,
    noMatch: parsed.noMatch ?? suggestions.length === 0,
  };
}
