"use client";

// Polish-pass demo for the chain bottleneck banner shipped in Change 4
// of the visibility-pass arc. Static — no DB. Recreates just the banner
// JSX inline (faithful copy of the production markup in ChainDrawer.tsx)
// so we can see all states side-by-side without instantiating the full
// portal-rendered chain drawer + its data plumbing.
//
// The threshold for surfacing is >7 days behind the median of the other
// claimed links. Below 7 days the banner stays hidden — close-running
// chains shouldn't be called a "holdup".

// ─── Scenario shape ──────────────────────────────────────────────────────────

type Scenario = {
  label: string;
  bottleneck: {
    address: string;
    daysBehind: number;
    isYourFile: boolean;
  } | null; // null = no banner renders for this scenario
  explainer?: string; // optional caption for "no banner" cases
};

// ─── The banner itself — verbatim copy of ChainDrawer JSX ────────────────────

function BottleneckBanner({ address, daysBehind, isYourFile }: { address: string; daysBehind: number; isYourFile: boolean }) {
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
          Holdup in this chain
        </p>
        <p style={{ fontSize: 12, color: "var(--agent-text-secondary)", margin: "2px 0 0", lineHeight: 1.4 }}>
          {isYourFile
            ? `Your file is currently the holdup in this chain — about ${daysBehind} days behind the others.`
            : `The file at ${address} is running about ${daysBehind} days behind the rest of the chain. Worth a coordinated nudge from chain-mates.`}
        </p>
      </div>
    </div>
  );
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  {
    label: "1. Someone else's file is the holdup (most common case)",
    bottleneck: {
      address: "47 Oak Road, Bristol, BS6 7TH",
      daysBehind: 14,
      isYourFile: false,
    },
  },
  {
    label: "2. YOUR file is the holdup (banner addresses you directly, still neutral)",
    bottleneck: {
      address: "12 Pine Lane, Bristol",
      daysBehind: 9,
      isYourFile: true,
    },
  },
  {
    label: "3. Modest gap (8 days) — banner still fires",
    bottleneck: {
      address: "5 Birchwood Crescent, Hertford",
      daysBehind: 8,
      isYourFile: false,
    },
  },
  {
    label: "4. Significant gap (24 days) — same banner, scaled number",
    bottleneck: {
      address: "22 Meadow View, Reading",
      daysBehind: 24,
      isYourFile: false,
    },
  },
  {
    label: "5. Close-running chain (gap <7 days) — no banner",
    bottleneck: null,
    explainer: "All links within 7 days of each other — no meaningful holdup. Banner stays hidden so it isn't noise.",
  },
  {
    label: "6. Only one claimed link — no banner (nothing to compare to)",
    bottleneck: null,
    explainer: "Single claimed link in the chain — bottleneck math needs ≥2 to compute a gap. Banner hidden.",
  },
  {
    label: "7. Chain is broken (a link has withdrawn) — bottleneck banner suppressed",
    bottleneck: null,
    explainer: "When isChainBroken(chain) returns true, the withdrawn-banner takes precedence. Bottleneck banner is hidden so the two amber/red signals don't fight each other.",
  },
  {
    label: "8. No predictions yet (all links early-estimate phase) — no banner",
    bottleneck: null,
    explainer: "If any claimed link has a null predictedExchangeDate, the bottleneck math returns null — no false signal when we can't tell where anyone will land.",
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ChainBottleneckDemoPage() {
  return (
    <div style={{ padding: "32px 32px 96px", maxWidth: 880, margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          Chain bottleneck banner — visibility pass #4
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
          Surfaces in the chain drawer (above the &ldquo;Add above&rdquo; button) when one claimed link is meaningfully behind the others. Eight scenarios — four where the banner fires, four where it stays hidden.
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
          Helper: <code>lib/chain/bottleneck.ts</code> · threshold: &gt;7 days behind the median predicted-exchange date of the other claimed links · phrasing: by address never agency name · safe to surface without MEDIANS_READY (relative comparison, not absolute).
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
          <strong>How the detection works:</strong>
        </p>
        <ol style={{ margin: "8px 0 0 18px", padding: 0, fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <li>Take every claimed link in the chain with a predicted exchange date.</li>
          <li>If &lt;2 such links exist, return null (nothing to compare).</li>
          <li>Sort by predicted date; the latest is the bottleneck candidate.</li>
          <li>Compute the median predicted date among the OTHER links (not including the slowest).</li>
          <li>Gap = slowest date − median of others, in days.</li>
          <li>If gap &lt; 7 days, return null (close-running, not a holdup).</li>
          <li>Otherwise return {"{ address, daysBehind, isYourFile }"} and render the banner.</li>
        </ol>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>Why this is safe to show without MEDIANS_READY:</strong> the comparison is between links in the same chain, all computed against the same (currently hardcoded) medians. If every link uses the same biased baseline, the slowest is still the slowest. The signal is &ldquo;link A is later than link B&rdquo; — never &ldquo;link A is later than typical&rdquo;. No claim of authority that the data can&apos;t back up.
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
          <strong>Phrasing rules baked in:</strong> always by address (never agency name); &ldquo;behind the rest of the chain&rdquo; not &ldquo;the slowest&rdquo;; &ldquo;worth a coordinated nudge from chain-mates&rdquo; frames action as collective, not blame. When the slow link is the viewer&apos;s own file, the wording stays neutral and addresses them directly.
        </p>
      </div>
    </div>
  );
}
