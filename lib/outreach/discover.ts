import { anthropic } from "@/lib/anthropic";

// Agent discovery for AI Outreach. Given an area (and the names we already hold),
// uses Claude with web search to find REAL UK estate agency branches in that area
// that we don't already have, and returns { name, location } lines ready to feed
// the existing prospect-import pipeline (research + dedupe + create). It never
// invents an agency: anything it can't find a real basis for is left out. This is
// discovery only - no DB writes here; the caller creates the import batch.

const DISCOVER_MODEL = process.env.PROSPECT_RESEARCH_MODEL ?? "claude-sonnet-5";

export type DiscoveredAgency = { name: string; location: string };

const SYSTEM = `You find REAL UK estate agency branches in a given area, for The Sales Progressor's outreach. Use web search to find genuine, currently-trading estate agents (sales branches) in or near the area given.

HARD RULES:
- Only return agencies you can actually find evidence of via search (their own site, Rightmove/Zoopla/OnTheMarket branch listings, Google business listings, directories). NEVER invent an agency or a branch.
- Return the trading name as people would recognise it, plus the town/area of that branch.
- Prefer independent and small-to-mid multi-branch agents over the largest national corporates, but real corporates are allowed.
- Do NOT return lettings-only agencies, auction houses, new-homes-only developers, or commercial-only agents. Sales estate agents only.
- Exclude any agency already in the provided EXCLUDE list (match loosely on name; if in doubt it's a duplicate, skip it).
- One entry per distinct branch. If a chain has several branches in the area, you may return each branch separately with its town.
- Accuracy over volume. Returning fewer real agencies is better than padding with guesses.

OUTPUT: after searching, output JSON ONLY wrapped exactly between the markers <<<RESULT>>> and <<<END>>>, no prose after. Shape:
<<<RESULT>>>
{"agencies":[{"name":"string","location":"string"}]}
<<<END>>>`;

export async function discoverAgencies(
  area: string,
  count: number,
  excludeNames: string[],
): Promise<DiscoveredAgency[]> {
  const exclude = excludeNames.slice(0, 400).join("; ");
  const msg = await anthropic.messages.create({
    model: DISCOVER_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
    messages: [
      {
        role: "user",
        content: `Find up to ${count} real UK estate agency sales branches in or near: ${area}.\n\nEXCLUDE (already held, skip these): ${exclude || "none"}\n\nReturn the JSON between the markers.`,
      },
    ],
  });

  const text = msg.content.map((b) => ("text" in b && b.type === "text" ? b.text : "")).join("\n");
  const start = text.indexOf("<<<RESULT>>>");
  const end = text.indexOf("<<<END>>>", start);
  if (start === -1 || end === -1) return [];
  let parsed: { agencies?: unknown };
  try {
    parsed = JSON.parse(text.slice(start + "<<<RESULT>>>".length, end).trim());
  } catch {
    return [];
  }
  const rows = Array.isArray(parsed.agencies) ? parsed.agencies : [];
  const out: DiscoveredAgency[] = [];
  const seen = new Set(excludeNames.map((n) => n.trim().toLowerCase()));
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const name = String((r as { name?: unknown }).name ?? "").trim();
    const location = String((r as { location?: unknown }).location ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue; // defensive dedupe against what we already hold
    seen.add(key);
    out.push({ name, location });
    if (out.length >= count) break;
  }
  return out;
}
