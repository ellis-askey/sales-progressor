"use client";

// Polish-pass demo for the chain bottleneck banner — visibility-pass
// Change 4 (v2 after walk-feedback). Static, no DB. Recreates the banner
// JSX inline (faithful copy of the production markup in ChainDrawer.tsx)
// so we can see all states side-by-side without instantiating the full
// portal-rendered chain drawer + its data plumbing.
//
// Two thresholds + one privacy split power the visible behaviour:
//   - >7 days behind the median of the other claimed links → banner shows
//   - audience split: viewer's OWN file gets specific stuck-milestone
//     detail (colon-form "Hold-up: searches ordered."), every other link
//     gets gap + address only. Server-side enforced — chain-mates never
//     see another agent's operational state on the wire.
//   - the stuck-milestone label is sourced from MILESTONE_GLOSSARY's
//     "Also called" row via getMilestoneShortLabel(code) — single source
//     of truth shared with the chase-AI prompts.

// ─── Scenario shape ──────────────────────────────────────────────────────────

type Scenario = {
  label: string;
  bottleneck: {
    address: string;
    daysBehind: number;
    isYourFile: boolean;
    stuckMilestoneLabel: string | null; // only ever non-null when isYourFile === true
  } | null; // null = no banner renders for this scenario
  explainer?: string; // optional caption for "no banner" cases
};

// ─── The banner itself — verbatim copy of ChainDrawer JSX ────────────────────

function BottleneckBanner({
  address,
  daysBehind,
  isYourFile,
  stuckMilestoneLabel,
}: {
  address: string;
  daysBehind: number;
  isYourFile: boolean;
  stuckMilestoneLabel: string | null;
}) {
  return (
    <div style={{
      marginBottom: 12,
      padding: "10px 12px",
      background: "rgba(245,158,11,0.08)",
      border: "0.5px solid rgba(245,158,11,0.25)",
      borderRadius: 8,
      display: "flex",
      alignItems: "flex-start",
      gap: 8,
    }}>
      <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>ℹ</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0, lineHeight: 1.5 }}>
          One file is behind the chain
        </p>
        <p style={{ fontSize: 12, color: "var(--agent-text-secondary)", margin: "2px 0 0", lineHeight: 1.4 }}>
          {isYourFile
            ? (stuckMilestoneLabel
                ? `Your file is about ${daysBehind} days behind the rest of the chain. Hold-up: ${stuckMilestoneLabel}. Worth a push if you can.`
                : `Your file is about ${daysBehind} days behind the rest of the chain. Worth a push if you can.`)
            : `${address} is about ${daysBehind} days behind the rest of the chain. A nudge across the chain may help.`}
        </p>
      </div>
    </div>
  );
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  {
    label: "1. Someone else's file is the holdup — neutral, no milestone detail (privacy boundary)",
    bottleneck: {
      address: "47 Oak Road, Bristol, BS6 7TH",
      daysBehind: 14,
      isYourFile: false,
      stuckMilestoneLabel: null, // never surfaced for other agents' files
    },
  },
  {
    label: "2. YOUR file is the holdup, with stuck-milestone label — specific, actionable",
    bottleneck: {
      address: "12 Pine Lane, Bristol",
      daysBehind: 9,
      isYourFile: true,
      stuckMilestoneLabel: "searches ordered", // PM8 first alias, lowercased
    },
  },
  {
    label: "3. YOUR file is the holdup, but stuck-milestone unknown — fallback wording (no \"Hold-up:\" line)",
    bottleneck: {
      address: "8 Maple Close, Reading",
      daysBehind: 11,
      isYourFile: true,
      stuckMilestoneLabel: null, // glossary miss, or no available milestone with computable becameAvailableAt
    },
  },
  {
    label: "4. YOUR file with a different stuck milestone (mortgage offer)",
    bottleneck: {
      address: "30 Riverbank Avenue, Reading",
      daysBehind: 12,
      isYourFile: true,
      stuckMilestoneLabel: "mortgage offer",
    },
  },
  {
    label: "5. YOUR file, stuck on an acronym milestone (DCP) — colon form sidesteps the article problem",
    bottleneck: {
      address: "4 Pinecrest Walk, Bristol",
      daysBehind: 10,
      isYourFile: true,
      stuckMilestoneLabel: "DCP",
    },
  },
  {
    label: "6. Significant gap (24 days), someone else's file — same neutral phrasing, scaled number",
    bottleneck: {
      address: "22 Meadow View, Reading",
      daysBehind: 24,
      isYourFile: false,
      stuckMilestoneLabel: null,
    },
  },
  {
    label: "7. Modest gap (8 days), someone else's file — banner still fires at threshold",
    bottleneck: {
      address: "5 Birchwood Crescent, Hertford",
      daysBehind: 8,
      isYourFile: false,
      stuckMilestoneLabel: null,
    },
  },
  {
    label: "8. Close-running chain (gap <7 days) — no banner",
    bottleneck: null,
    explainer: "All links within 7 days of each other. No meaningful holdup. Banner stays hidden so it isn't noise.",
  },
  {
    label: "9. Only one claimed link — no banner (nothing to compare to)",
    bottleneck: null,
    explainer: "Single claimed link in the chain. Bottleneck math needs at least two to compute a gap. Banner hidden.",
  },
  {
    label: "10. Chain is broken (a link has withdrawn) — bottleneck banner suppressed",
    bottleneck: null,
    explainer: "When isChainBroken(chain) returns true, the withdrawn-banner takes precedence. Bottleneck banner is hidden so the two amber/red signals don't fight each other.",
  },
  {
    label: "11. No predictions yet (all links early-estimate phase) — no banner",
    bottleneck: null,
    explainer: "If any claimed link has a null predictedExchangeDate, the bottleneck math returns null. No false signal when we can't tell where anyone will land.",
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ChainBottleneckDemoPage() {
  return (
    <div style={{ padding: "32px 32px 96px", maxWidth: 880, margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          Chain bottleneck banner — visibility pass #4 (v2)
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
          Surfaces in the chain drawer (above the &ldquo;Add above&rdquo; button) when one claimed link is meaningfully behind the others. Audience-split: viewer&apos;s OWN file gets the specific stuck-milestone label; everyone else&apos;s gets gap and address only. Eleven scenarios.
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
          Helpers: <code>lib/chain/bottleneck.ts</code> (relative comparison) &middot; <code>lib/services/chains.ts</code> (stuck-milestone identification, viewer-link only) &middot; <code>lib/chase/milestone-glossary.ts</code> (shared source for the short label). Threshold: &gt;7 days behind the median predicted-exchange date of the other claimed links. Safe to surface without MEDIANS_READY (relative comparison, not absolute).
        </p>
      </header>

      {SCENARIOS.map((s, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <p style={{
            margin: 0,
            padding: "9px 14px",
            background: "rgba(30, 45, 74, 0.04)",
            border: "0.5px solid var(--agent-border-default)",
            borderRadius: "8px 8px 0 0",
            fontSize: 10,
            fontFamily: "monospace",
            color: "rgba(30, 45, 74, 0.6)",
            fontWeight: 600,
          }}>
            {s.label}
          </p>
          <div style={{
            background: "var(--agent-surface-elevated)",
            border: "0.5px solid var(--agent-border-default)",
            borderTop: "none",
            borderRadius: "0 0 8px 8px",
            padding: 14,
          }}>
            {s.bottleneck ? (
              <BottleneckBanner {...s.bottleneck} />
            ) : (
              <p style={{
                margin: 0,
                padding: "12px",
                background: "rgba(30, 45, 74, 0.03)",
                border: "0.5px dashed var(--agent-border-default)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--agent-text-muted)",
                fontStyle: "italic",
                lineHeight: 1.5,
              }}>
                (No banner.) {s.explainer}
              </p>
            )}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 24, padding: 16, background: "rgba(30, 45, 74, 0.04)", borderRadius: 10 }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>How the detection works</strong>
        </p>
        <ol style={{ margin: "8px 0 0 18px", padding: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <li>Take every claimed link in the chain with a predicted exchange date.</li>
          <li>If &lt;2 such links exist, return null (nothing to compare).</li>
          <li>Sort by predicted date; the latest is the bottleneck candidate.</li>
          <li>Compute the median predicted date among the OTHER links (excluding the slowest).</li>
          <li>Gap = slowest date &minus; median of others, in days.</li>
          <li>If gap &lt; 7 days, return null (close-running, not a holdup).</li>
          <li>Otherwise return the bottleneck and render the banner.</li>
        </ol>

        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>Privacy boundary &mdash; the audience split:</strong> the stuck-milestone label is sourced server-side in <code>getChainV2</code> and only attached to the link where <code>claimedByUserId === viewerUserId</code>. Every other link gets <code>stuckMilestoneLabel: null</code> before the payload leaves the server. Chain-mates never see another agent&apos;s milestone-level detail. This mirrors the chain feature&apos;s existing rule: full operational visibility on your own file, summary signal on others&apos;.
        </p>

        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>Where the label comes from:</strong> the milestone-staleness module identifies the milestone currently in state <code>available</code> with the oldest <code>becameAvailableAt</code> proxy (latest <code>completedAt</code> across its direct prerequisites). That code is passed to <code>getMilestoneShortLabel(code)</code>, which reads the first quoted alias from <code>docs/chase-generation/MILESTONE_GLOSSARY.md</code>. Same glossary the chase AI uses &mdash; single source of truth, no parallel dictionary to drift.
        </p>

        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>Colon-form copy:</strong> &ldquo;Hold-up: {`{label}`}.&rdquo; sidesteps the article problem entirely. &ldquo;Hold-up: searches ordered.&rdquo;, &ldquo;Hold-up: survey.&rdquo;, &ldquo;Hold-up: DCP.&rdquo; all read cleanly. New milestone codes added later need no template change.
        </p>

        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>Why this is safe to show without MEDIANS_READY:</strong> the comparison is between links in the same chain, all computed against the same (currently hardcoded) medians. If every link uses the same biased baseline, the slowest is still the slowest. The signal is &ldquo;link A is later than link B&rdquo;, never &ldquo;link A is later than typical&rdquo;. No claim of authority the data can&apos;t back up.
        </p>
      </div>
    </div>
  );
}
