"use client";

// "Automation coverage" panel — a per-file health donut. Where the activity
// KPIs count emails, this counts FILES: for everything we're watching, is
// automation actually set up and running? Three buckets, drawn as a ring with
// a legend. Colour is never the only signal — every slice has a labelled row.

import Link from "next/link";
import { GlassCard } from "@/components/glass/GlassCard";
import type { AutomationCoverage } from "@/lib/services/automated-emails-coverage";

const COVERED = "var(--agent-success)";
const NEED = "var(--agent-warning)";
const PAUSED = "var(--agent-text-muted)";

const CARD_STYLE = { padding: "18px 20px", borderRadius: "var(--agent-radius-xl)" } as const;

function ringBackground(c: AutomationCoverage): string {
  if (c.total === 0) return "var(--agent-border-subtle, rgba(15,23,42,0.10))";
  const a1 = (c.covered / c.total) * 360;
  const a2 = a1 + (c.needInfo / c.total) * 360;
  return `conic-gradient(${COVERED} 0 ${a1}deg, ${NEED} ${a1}deg ${a2}deg, ${PAUSED} ${a2}deg 360deg)`;
}

export function AutomationCoveragePanel({ coverage }: { coverage: AutomationCoverage }) {
  const { total, covered, needInfo, paused } = coverage;

  return (
    <GlassCard glassId="auto-emails-coverage" label="Auto emails · Coverage" defaultVariant="v05" style={CARD_STYLE}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", marginBottom: 16 }}>Automation coverage</h2>

      {total === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
          No active files to monitor right now.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <div
            role="img"
            aria-label={`${covered} of ${total} files fully covered, ${needInfo} need information, ${paused} paused`}
            style={{ position: "relative", width: 148, height: 148 }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: ringBackground(coverage),
                WebkitMaskImage: "radial-gradient(circle, transparent 53%, #000 54%)",
                maskImage: "radial-gradient(circle, transparent 53%, #000 54%)",
              }}
            />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ fontSize: 30, fontWeight: 720, letterSpacing: "-0.02em", color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{total}</span>
              <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{total === 1 ? "File" : "Files"}</span>
            </div>
          </div>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            <LegendRow colour={COVERED} value={covered} title="Fully covered" sub="All contacts present, chasing on" />
            <LegendRow colour={NEED} value={needInfo} title="Need information" sub="Missing a client email address" />
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
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 3, marginTop: 4, flexShrink: 0, background: colour }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "var(--agent-text-primary)" }}>
          <b style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</b> {title}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>{sub}</div>
      </div>
    </div>
  );
}
