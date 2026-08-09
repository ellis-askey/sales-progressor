// Hub polish PR 1 — "Wins this month" card.
//
// Always shows something, cascading through 4 tiers so brand-new accounts
// still see a positive signal:
//   Tier 1 — has exchanges this month → celebrate exchanges + completions +
//            fastest-exchange address
//   Tier 2 — has completions but no exchanges → completions + steps confirmed
//   Tier 3 — no closings but activity → steps confirmed + new files
//   Tier 4 — brand-new (no activity) → motivational fallback
//
// Data shape from lib/services/hub.ts getHubWins(). Pure presentation.

import { Trophy, Flag, Sparkle, Rocket } from "@phosphor-icons/react/dist/ssr";
import type { HubWins } from "@/lib/services/hub";

type Tier = "exchanges" | "completions" | "progress" | "fresh";

function pickTier(wins: HubWins): Tier {
  if (wins.exchangesThisMonth > 0) return "exchanges";
  if (wins.completionsThisMonth > 0) return "completions";
  if (wins.stepsConfirmedThisWeek > 0 || wins.newFilesThisMonth > 0) return "progress";
  return "fresh";
}

function trendCopy(current: number, prior: number, singular: string, plural: string): { text: string; tone: "up" | "flat" | "down" } {
  if (prior === 0 && current > 0) return { text: `New this month`, tone: "up" };
  if (prior === 0 && current === 0) return { text: `None yet`, tone: "flat" };
  const delta = current - prior;
  if (delta > 0) return { text: `↑ ${delta} vs last month`, tone: "up" };
  if (delta < 0) return { text: `↓ ${Math.abs(delta)} vs last month`, tone: "down" };
  return { text: `Same as last month`, tone: "flat" };
}

const toneColor: Record<"up" | "flat" | "down", string> = {
  up: "var(--agent-success)",
  flat: "var(--agent-text-muted)",
  down: "var(--agent-warning)",
};

export function WinsCard({ wins }: { wins: HubWins }) {
  const tier = pickTier(wins);
  // 2026-08-09 hub Design-Lab pass: surface (agent-glass frost + padding)
  // moved OUT to the GlassCard wrapper at the call site (glassId
  // `hub-wins`), so the card is pickable. commonWrap now carries only the
  // inner flex layout — the four tier branches stay untouched.
  const commonWrap = {
    style: {
      display: "flex",
      flexDirection: "column" as const,
      gap: 14,
      minHeight: 200,
    },
  };

  // Header content (icon + eyebrow + subtitle) is uniform across tiers.
  const headerBlock = (icon: React.ReactNode, subtitle: string) => (
    <div className="agent-card-hdr-internal" style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: "var(--agent-coral-bg-tint)",
        color: "var(--agent-coral-deep)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Wins this month</p>
        <p className="agent-card-subtitle" style={{ margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );

  // Tier 1 — full exchanges celebration.
  if (tier === "exchanges") {
    const exchangeTrend = trendCopy(wins.exchangesThisMonth, wins.exchangesLastMonth, "exchange", "exchanges");
    return (
      <div {...commonWrap}>
        {headerBlock(<Trophy size={17} weight="fill" />, "You're moving fast.")}
        <div>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
            {wins.exchangesThisMonth}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", fontWeight: 500 }}>
            {wins.exchangesThisMonth === 1 ? "exchange" : "exchanges"} completed
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 500, color: toneColor[exchangeTrend.tone] }}>
            {exchangeTrend.text}
          </p>
        </div>
        <div style={{
          borderTop: "0.5px solid var(--agent-border-subtle)",
          paddingTop: 12,
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          {wins.completionsThisMonth > 0 && (
            <StatRow label={wins.completionsThisMonth === 1 ? "completion" : "completions"} value={wins.completionsThisMonth} />
          )}
          {wins.fastestExchangeDays !== null && wins.fastestExchangeAddress && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Fastest exchange
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {wins.fastestExchangeAddress}
                </p>
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--agent-coral-deep)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {wins.fastestExchangeDays}d
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tier 2 — completions only.
  if (tier === "completions") {
    const completionTrend = trendCopy(wins.completionsThisMonth, wins.completionsLastMonth, "completion", "completions");
    return (
      <div {...commonWrap}>
        {headerBlock(<Flag size={17} weight="fill" />, "Files across the line.")}
        <div>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
            {wins.completionsThisMonth}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", fontWeight: 500 }}>
            {wins.completionsThisMonth === 1 ? "completion" : "completions"}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 500, color: toneColor[completionTrend.tone] }}>
            {completionTrend.text}
          </p>
        </div>
        {(wins.stepsConfirmedThisWeek > 0 || wins.newFilesThisMonth > 0) && (
          <div style={{
            borderTop: "0.5px solid var(--agent-border-subtle)",
            paddingTop: 12,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            {wins.stepsConfirmedThisWeek > 0 && (
              <StatRow label="steps confirmed this week" value={wins.stepsConfirmedThisWeek} />
            )}
            {wins.newFilesThisMonth > 0 && (
              <StatRow label="new files this month" value={wins.newFilesThisMonth} />
            )}
          </div>
        )}
      </div>
    );
  }

  // Tier 3 — progress-only.
  if (tier === "progress") {
    return (
      <div {...commonWrap}>
        {headerBlock(<Sparkle size={17} weight="fill" />, "Pipeline is moving.")}
        {wins.stepsConfirmedThisWeek > 0 && (
          <div>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
              {wins.stepsConfirmedThisWeek}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", fontWeight: 500 }}>
              {wins.stepsConfirmedThisWeek === 1 ? "step" : "steps"} confirmed this week
            </p>
          </div>
        )}
        {wins.newFilesThisMonth > 0 && (
          <div style={{
            borderTop: "0.5px solid var(--agent-border-subtle)",
            paddingTop: 12,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <StatRow
              label={wins.newFilesThisMonth === 1 ? "new file this month" : "new files this month"}
              value={wins.newFilesThisMonth}
            />
          </div>
        )}
        <p style={{ margin: "auto 0 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
          Exchanges and completions will land here as files close.
        </p>
      </div>
    );
  }

  // Tier 4 — brand-new account.
  return (
    <div {...commonWrap}>
      {headerBlock(<Rocket size={17} weight="fill" />, "Nothing to celebrate yet.")}
      <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>
        Add your first sale to start tracking wins. Exchanges, completions, and fastest-exchange records will show up here as files progress.
      </p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
    </div>
  );
}
