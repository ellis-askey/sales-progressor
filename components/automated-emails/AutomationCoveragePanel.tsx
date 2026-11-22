"use client";

// "Automation coverage" panel — a per-file health donut. Where the activity
// KPIs count emails, this counts FILES: for everything we're watching, is
// automation actually set up and running? Three buckets, drawn as a ring with
// a legend. Colour is never the only signal — every slice has a labelled row.

import Link from "next/link";
import { GlassCard } from "@/components/glass/GlassCard";
import { Donut } from "@/components/ui/Donut";
import { StatNumber } from "@/components/ui/StatNumber";
import { LegendItem } from "@/components/ui/LegendItem";
import { PanelHeader } from "@/components/ui/PanelHeader";
import type { AutomationCoverage } from "@/lib/services/automated-emails-coverage";

const COVERED = "var(--agent-success)";
const NEED = "var(--agent-warning)";
const OPTED = "var(--agent-indigo)"; // indigo — informational (they chose to unsubscribe), not a problem
const PAUSED = "var(--agent-text-muted)";

const CARD_STYLE = { padding: "18px 20px", borderRadius: "var(--agent-radius-xl)" } as const;

export function AutomationCoveragePanel({ coverage }: { coverage: AutomationCoverage }) {
  const { total, covered, needInfo, optedOut, paused } = coverage;

  return (
    <GlassCard glassId="auto-emails-coverage" label="Auto emails · Coverage" defaultVariant="v05" style={CARD_STYLE}>
      <PanelHeader title="Automation coverage" style={{ marginBottom: 16 }} />

      {total === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
          No active files to monitor right now.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div
            role="img"
            aria-label={`${covered} of ${total} files fully covered, ${needInfo} need information, ${optedOut} opted out, ${paused} paused`}
            style={{ position: "relative", width: 148, height: 148, display: "grid", placeItems: "center" }}
          >
            <Donut
              size={148}
              thickness={14}
              segments={[
                { value: covered, color: COVERED },
                { value: needInfo, color: NEED },
                { value: optedOut, color: OPTED },
                { value: paused, color: PAUSED },
              ].filter((s) => s.value > 0)}
            />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <StatNumber>{total}</StatNumber>
              <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{total === 1 ? "File" : "Files"}</span>
            </div>
          </div>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            <LegendRow colour={COVERED} value={covered} title="Fully covered" sub="All contacts present, chasing on" />
            <LegendRow colour={NEED} value={needInfo} title="Need information" sub="Missing a client email address" />
            {optedOut > 0 && <LegendRow colour={OPTED} value={optedOut} title="Opted out" sub="They unsubscribed, so we won't email them" />}
            <LegendRow colour={PAUSED} value={paused} title="Paused" sub="Automation paused on the file" />
          </div>

          <Link href="/agent/automated-emails?tab=files" className="agent-link" style={{ alignSelf: "flex-start", fontSize: 12.5, fontWeight: 600 }}>
            View coverage details
          </Link>
        </div>
      )}
    </GlassCard>
  );
}

function LegendRow({ colour, value, title, sub }: { colour: string; value: number; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <LegendItem color={colour} value={value} label={title} />
      <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>{sub}</span>
    </div>
  );
}
