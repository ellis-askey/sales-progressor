import { anthropic } from "@/lib/anthropic";

// Prospect research engine. Given an agency name (+ optional location), uses
// Claude with the web_search tool to gather from the official website, Companies
// House's public pages, professional/regulatory listings, LinkedIn and portals,
// cross-checks, and returns a STRUCTURED result with a verification state and a
// source per field. It never invents: unknown fields come back null, inferred
// values come back needs_check. No DB writes — the caller applies the result.
//
// Companies House is used via the public site through web search. A future
// Companies House API key (env, optional) would make company/director matching
// more reliable and enable a deterministic clean-up sweep, without changing this.

const RESEARCH_MODEL = process.env.PROSPECT_RESEARCH_MODEL ?? "claude-sonnet-5";

export type ResearchField = {
  value: string;
  state: "verified" | "needs_check";
  sourceName?: string;
  sourceUrl?: string;
  confidence?: "high" | "medium" | "low";
  note?: string;
};

export type ResearchResult = {
  agency: {
    tradingName?: ResearchField | null;
    location?: ResearchField | null;
    postcode?: ResearchField | null;
    website?: ResearchField | null;
    phone?: ResearchField | null;
    generalEmail?: ResearchField | null;
  };
  contact?: {
    name: ResearchField;
    role?: ResearchField | null;
    email?: ResearchField | null;
    phone?: ResearchField | null;
    isDecisionMaker: boolean;
  } | null;
  notes?: string | null;
  companyNumber?: string | null;
};

const SYSTEM = `You research a single UK estate agency for The Sales Progressor (TSP), a service that runs estate agents' sales progression and chasing for them (charged only when a sale exchanges). Your job: identify the correct business and the most commercially useful decision-maker, and return a STRICT structured result.

ACCURACY OVER COMPLETENESS. Never invent anything. An empty field is better than a wrong one.

SOURCES, in rough order of trust: (1) the agency's official website, (2) Companies House public records at find-and-update.company-information.service.gov.uk, (3) regulatory/professional listings (The Property Ombudsman, Propertymark), (4) verified LinkedIn, (5) Rightmove/Zoopla/OnTheMarket agency profiles, (6) Google/business directories. Cross-check across sources. Do not treat a directory as definitive when an official source disagrees.

VERIFICATION STATE per field:
- "verified": an authoritative source states it and nothing credible contradicts it (official website for phone/email; Companies House for a director). Prefer two-source corroboration.
- "needs_check": probably right but not conclusive — a single weaker source, a conflict between sources, a LinkedIn title that may not be current, or ANY inferred value.
- If you cannot establish a field with reasonable confidence, return null for it. Do NOT guess.

HARD RULES:
- Never return a phone number you have not seen on a real source. No made-up numbers.
- Never mark an inferred email (a firstname@domain pattern) as verified. If you infer an email, state MUST be needs_check with a note saying it is inferred. If you have no basis, return null for email.
- Similar-name caution: only trust a Companies House match when several of {trading name, website/domain, location, registered address, directors, incorporation} line up. A near-identical name alone is NOT a match — note the risk and use needs_check or null.
- Do not assume a prominent person on the website is the owner. Do not assume a Companies House director is the outreach contact. Do not treat a LinkedIn title as current if there is evidence the person has left (e.g. resigned at Companies House).

DECISION-MAKER (pick the person most able to decide whether that office/group uses TSP):
- Single branch / small independent: Owner > Founder > Managing Director > Director.
- Small multi-branch independent: Owner / MD / Sales Director / Operations Director, unless there is a clearly relevant branch-level decision-maker.
- Larger multi-branch: someone responsible for the branch or sales operation (Area/Regional/Branch/Sales Manager) rather than a remote company director.
- Large corporate/group: Regional / Area / Operations / Residential Sales decision-maker.
Companies House is heavily used to establish ownership/directorship of independents, but must NOT automatically determine the outreach contact. Set isDecisionMaker true only when you are confident this person can make that decision.

NOTES: write ONE compact paragraph (not a report) useful for outreach: how long operating, founder/ownership if relevant, independent/group/franchise structure, branches/coverage, growth, sales focus, any evidence of how progression is currently handled, technology/process positioning, and the specific TSP angle. Avoid generic filler ("well-established agent offering excellent service"). If you cannot establish how progression is handled, do NOT claim they do it internally — say "No dedicated sales progression function identified publicly" or focus the angle on their structure.

DO NOT research or return company size / listing counts. That field is filled manually.

OUTPUT: after any searching, output the result as JSON ONLY, wrapped exactly between the markers <<<RESULT>>> and <<<END>>>, no prose after. Every field object is either null or { "value": string, "state": "verified"|"needs_check", "sourceName": string, "sourceUrl": string, "confidence": "high"|"medium"|"low", "note"?: string }. Shape:
<<<RESULT>>>
{"agency":{"tradingName":FIELD|null,"location":FIELD|null,"postcode":FIELD|null,"website":FIELD|null,"phone":FIELD|null,"generalEmail":FIELD|null},"contact":{"name":FIELD,"role":FIELD|null,"email":FIELD|null,"phone":FIELD|null,"isDecisionMaker":true|false}|null,"notes":"one paragraph"|null,"companyNumber":"12345678"|null}
<<<END>>>`;

export async function researchAgency(agencyName: string, location?: string | null): Promise<ResearchResult> {
  const msg = await anthropic.messages.create({
    model: RESEARCH_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 7 }],
    messages: [{ role: "user", content: `Research this UK estate agency and return the JSON.\n\nAgency: ${agencyName}${location ? `\nLocation: ${location}` : ""}` }],
  });

  const text = msg.content.map((b) => ("text" in b && b.type === "text" ? b.text : "")).join("\n");
  const start = text.indexOf("<<<RESULT>>>");
  const end = text.indexOf("<<<END>>>", start);
  if (start === -1 || end === -1) throw new Error("Research returned no structured result.");
  const json = text.slice(start + "<<<RESULT>>>".length, end).trim();
  try {
    return JSON.parse(json) as ResearchResult;
  } catch {
    throw new Error("Research result could not be parsed.");
  }
}
