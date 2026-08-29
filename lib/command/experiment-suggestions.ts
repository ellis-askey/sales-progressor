import { prisma } from "@/lib/prisma";
import { computeExperimentMetrics, type MetricKey } from "@/lib/command/experiment-metrics";

// The "what should we test" engine for Growth tests. A curated catalogue of
// experiment ideas, each tied to a real lever in the app and a trigger read from
// live data. Only relevant ideas surface, ranked by opportunity, each written in
// plain English with the real number behind it. (AI wildcard ideas are added
// separately, on demand, in the same shape.)

export type ExperimentSuggestion = {
  id: string;
  source: "catalog" | "ai";
  category: string;
  title: string;
  change: string; // what we'd change
  why: string; // plain-English rationale, with the live number
  metricKey: MetricKey; // primary metric to watch
  guardrailKeys: MetricKey[];
  durationDays: number;
  expectedDirection: "up" | "down";
  opportunity: number; // ranking only
};

type Ctx = {
  liveClients: number;
  clientsWithPush: number;
  pushRate: number;
  clientsVisited: number;
  visitRate: number;
  buyers: number;
  m: Record<MetricKey, number>; // last-30-day metric values
};

async function buildContext(): Promise<Ctx> {
  const now = new Date();
  const since30 = new Date(now);
  since30.setUTCDate(since30.getUTCDate() - 30);

  const [m, clients] = await Promise.all([
    computeExperimentMetrics(since30, now),
    prisma.contact.findMany({
      where: {
        portalToken: { not: null },
        roleType: { in: ["vendor", "purchaser"] },
        transaction: { status: { in: ["active", "on_hold"] }, isDemo: false, agency: { isInternal: false } },
      },
      select: {
        roleType: true,
        lastVisitedPortalAt: true,
        pushSubscriptions: { select: { id: true }, take: 1 },
      },
    }),
  ]);

  const liveClients = clients.length;
  const clientsWithPush = clients.filter((c) => c.pushSubscriptions.length > 0).length;
  const clientsVisited = clients.filter((c) => c.lastVisitedPortalAt != null).length;
  const buyers = clients.filter((c) => c.roleType === "purchaser").length;

  return {
    liveClients,
    clientsWithPush,
    pushRate: liveClients ? clientsWithPush / liveClients : 0,
    clientsVisited,
    visitRate: liveClients ? clientsVisited / liveClients : 0,
    buyers,
    m,
  };
}

const pctStr = (r: number) => `${Math.round(r * 100)}%`;

type Template = {
  id: string;
  category: string;
  title: string;
  change: string;
  metricKey: MetricKey;
  guardrailKeys: MetricKey[];
  durationDays: number;
  // Returns null when the idea isn't worth surfacing right now.
  evaluate: (c: Ctx) => { why: string; opportunity: number } | null;
};

const CATALOG: Template[] = [
  {
    id: "push_timing",
    category: "Portal adoption",
    title: "Ask for notifications after the first good news, not on arrival",
    change: "Move the 'turn on notifications' prompt to just after a client's first milestone lands, when they're pleased, instead of on their first visit.",
    metricKey: "pushOptins",
    guardrailKeys: ["uniqueActiveUsersAvg"],
    durationDays: 21,
    evaluate: (c) => {
      if (c.liveClients < 3 || c.pushRate >= 0.5) return null;
      return {
        why: `Only ${pctStr(c.pushRate)} of clients (${c.clientsWithPush} of ${c.liveClients}) have notifications on. Clients who do tend to come back more, so lifting this should lift engagement.`,
        opportunity: (0.5 - c.pushRate) * c.liveClients,
      };
    },
  },
  {
    id: "followup_copy",
    category: "Conversion",
    title: "Rewrite the 'email your conveyancer' nudge to get more follow-through",
    change: "Test clearer, warmer copy on the conveyancer follow-up (what to say, why it helps) so more of the clients who tap it actually send.",
    metricKey: "followupTaps",
    guardrailKeys: [],
    durationDays: 21,
    evaluate: (c) => {
      if (c.m.followupTaps < 1) return null;
      return {
        why: `Clients tapped 'email your conveyancer' ${c.m.followupTaps} times in the last 30 days. Better copy could raise how many follow through.`,
        opportunity: c.m.followupTaps,
      };
    },
  },
  {
    id: "quote_card_placement",
    category: "Revenue",
    title: "Surface the quote card earlier for buyers",
    change: "Show the survey/broker quote card sooner in the buyer's journey (e.g. once searches are ordered) instead of leaving it further down.",
    metricKey: "quoteRequests",
    guardrailKeys: [],
    durationDays: 28,
    evaluate: (c) => {
      if (c.buyers < 3) return null;
      return {
        why: `${c.m.quoteRequests} quote requests came through in 30 days from ${c.buyers} active buyers. Surfacing the card earlier could raise that (and referral income with it).`,
        opportunity: Math.max(1, c.buyers - c.m.quoteRequests),
      };
    },
  },
  {
    id: "welcome_return",
    category: "Portal adoption",
    title: "Strengthen the first-visit welcome so more clients come back",
    change: "Test a warmer, clearer welcome sheet that shows a client what they can do here, so more return after the first visit.",
    metricKey: "uniqueActiveUsersAvg",
    guardrailKeys: [],
    durationDays: 28,
    evaluate: (c) => {
      if (c.liveClients < 3 || c.visitRate >= 0.7) return null;
      return {
        why: `${pctStr(c.visitRate)} of clients have ever opened their portal. A stronger welcome could lift how many come back and stay active.`,
        opportunity: (0.7 - c.visitRate) * c.liveClients,
      };
    },
  },
  {
    id: "client_confirm_prompt",
    category: "Self-service",
    title: "Make the 'confirm this step' prompt clearer for clients",
    change: "Test a clearer client-side prompt to confirm a step or set a date, so more gets done without an agent chasing.",
    metricKey: "clientConfirms",
    guardrailKeys: ["milestonesConfirmed"],
    durationDays: 28,
    evaluate: (c) => {
      if (c.liveClients < 3) return null;
      return {
        why: `Clients confirmed only ${c.m.clientConfirms} steps themselves in 30 days. A clearer prompt could lift self-service and take load off the team.`,
        opportunity: Math.max(1, c.liveClients - c.m.clientConfirms),
      };
    },
  },
  {
    id: "doc_upload_prompt",
    category: "Self-service",
    title: "Prompt clients to upload documents at the right moment",
    change: "Test a timely prompt asking clients to upload the document a step needs, right when it's needed.",
    metricKey: "portalDocsUploaded",
    guardrailKeys: [],
    durationDays: 28,
    evaluate: (c) => {
      if (c.liveClients < 3 || c.m.portalDocsUploaded >= c.liveClients) return null;
      return {
        why: `Only ${c.m.portalDocsUploaded} documents were uploaded by clients in 30 days across ${c.liveClients} live files. A well-timed prompt could raise that.`,
        opportunity: Math.max(1, c.liveClients - c.m.portalDocsUploaded),
      };
    },
  },
  {
    id: "chase_timing",
    category: "Chasing",
    title: "Test tighter chase timing on stalled steps",
    change: "Shorten the wait before the first chase on a step that's gone quiet, and see whether milestones move faster without more opt-outs.",
    metricKey: "milestonesConfirmed",
    guardrailKeys: ["chasesSent"],
    durationDays: 21,
    evaluate: (c) => {
      if (c.m.milestonesConfirmed < 5) return null;
      return {
        why: `About ${Math.round(c.m.milestonesConfirmed / 4)} milestones confirm per week right now. Tighter chase timing could lift that, so long as chases don't balloon.`,
        opportunity: c.m.milestonesConfirmed / 8,
      };
    },
  },
  {
    id: "message_prompt",
    category: "Portal adoption",
    title: "Invite clients to message their agent from the portal",
    change: "Test a light prompt encouraging clients to ask their question in the portal rather than by email or phone, so it lands on the file.",
    metricKey: "portalMessages",
    guardrailKeys: [],
    durationDays: 28,
    evaluate: (c) => {
      if (c.liveClients < 3 || c.m.portalMessages >= c.liveClients) return null;
      return {
        why: `Clients sent ${c.m.portalMessages} portal messages in 30 days across ${c.liveClients} live files. A gentle prompt could bring more conversation onto the file.`,
        opportunity: Math.max(1, Math.round((c.liveClients - c.m.portalMessages) / 2)),
      };
    },
  },
];

export async function getExperimentSuggestions(): Promise<ExperimentSuggestion[]> {
  const ctx = await buildContext();
  const out: ExperimentSuggestion[] = [];
  for (const t of CATALOG) {
    const r = t.evaluate(ctx);
    if (!r) continue;
    out.push({
      id: t.id,
      source: "catalog",
      category: t.category,
      title: t.title,
      change: t.change,
      why: r.why,
      metricKey: t.metricKey,
      guardrailKeys: t.guardrailKeys,
      durationDays: t.durationDays,
      expectedDirection: "up",
      opportunity: r.opportunity,
    });
  }
  out.sort((a, b) => b.opportunity - a.opportunity);
  return out.slice(0, 6);
}

// Compact data summary handed to the AI wildcard generator, so its ideas are
// grounded in the same live numbers the catalogue uses.
export async function getSuggestionDataSummary(): Promise<string> {
  const c = await buildContext();
  return [
    `Live client files: ${c.liveClients}`,
    `Clients with notifications on: ${c.clientsWithPush} (${pctStr(c.pushRate)})`,
    `Clients who have opened the portal: ${c.clientsVisited} (${pctStr(c.visitRate)})`,
    `Active buyers: ${c.buyers}`,
    `Last 30 days — milestones confirmed: ${c.m.milestonesConfirmed}, sales started: ${c.m.transactionsCreated}, chases sent: ${c.m.chasesSent}`,
    `Last 30 days — conveyancer nudges: ${c.m.followupTaps}, quote requests: ${c.m.quoteRequests}, notification opt-ins: ${c.m.pushOptins}, portal messages: ${c.m.portalMessages}, client confirms: ${c.m.clientConfirms}, client uploads: ${c.m.portalDocsUploaded}`,
  ].join("\n");
}
