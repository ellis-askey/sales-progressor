"use client";

// At-a-glance health strip that leads the Automated-emails page. Reassurance
// first: one line on whether automation is running, then the four numbers an
// agent scans for — what's queued, what's chasing today, what needs them, and
// how many files we're watching. Every figure is scope-derived upstream
// (automated-emails-overview.ts), so it never shows more than the viewer may see.

import { GlassCard } from "@/components/glass/GlassCard";
import type { AutomationBanner as BannerData } from "@/lib/services/automated-emails-overview";

function nextSendLabel(at: Date | null): string {
  if (!at) return "Nothing queued";
  const ms = new Date(at).getTime() - Date.now();
  if (ms <= 0) return "Sending now";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `Next in ${mins} min${mins === 1 ? "" : "s"}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Next in ${hrs} hour${hrs === 1 ? "" : "s"}`;
  return `Next ${new Date(at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" })}`;
}

export function AutomationBanner({
  banner,
  needsTotal,
  queuedNow,
}: {
  banner: BannerData;
  needsTotal: number;
  queuedNow: number;
}) {
  const paused = banner.automationPaused;
  const fileWord = banner.activeFiles === 1 ? "file" : "files";

  // Three honest states (truth pass 2026-10-21): "healthy" previously meant
  // only "the global switch is on" and sat happily next to 30 problems. Now:
  // paused > needs attention > healthy — healthy means nothing needs a person.
  const state: "paused" | "attention" | "healthy" =
    paused ? "paused" : needsTotal > 0 ? "attention" : "healthy";
  const headline =
    state === "paused" ? "Automation paused"
    : state === "attention" ? "Needs your attention"
    : "Automation healthy";
  const subline =
    state === "paused"
      ? "Chases are paused right now."
      : state === "attention"
        ? `Chasing is running across ${banner.activeFiles} active ${fileWord}, but ${needsTotal === 1 ? "1 thing needs" : `${needsTotal} things need`} a person. They're listed below.`
        : `We're monitoring and chasing ${banner.activeFiles === 1 ? "" : "across "}${banner.activeFiles} active ${fileWord}. Nothing needs you.`;
  const tileBg = state === "healthy" ? "var(--agent-success-bg)" : "var(--agent-warning-bg)";
  const tileFg = state === "healthy" ? "var(--agent-success)" : "var(--agent-warning)";

  return (
    <GlassCard
      glassId="auto-emails-banner"
      label="Auto emails · Health"
      defaultVariant="v05"
      style={{ padding: "16px 22px", borderRadius: "var(--agent-radius-xl)", marginBottom: 16 }}
    >
      {/* Wrap-safe spread (founder feedback 2026-10-21: the old ml-auto strip
          left a dead zone mid-card once it wrapped). The lead grows to fill,
          justify-between keeps the stats hugging the right edge on wide
          screens, and on narrow screens the strip drops below the lead,
          left-aligned, with no stranded gap. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px 24px", flexWrap: "wrap" }}>
        {/* Health lead */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 260, flex: "1 1 340px" }}>
          <span
            aria-hidden="true"
            style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              display: "grid", placeItems: "center",
              background: tileBg,
              color: tileFg,
            }}
          >
            {state === "paused" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : state === "attention" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg>
            )}
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>
              {headline}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>
              {subline}
            </p>
          </div>
        </div>

        {/* Stat strip. "Sent today / still to go" replaces the old "Chasing
            today", which counted only what was still waiting (and client
            chases only) — it read 0 every afternoon while sends had gone. */}
        <div style={{ display: "flex", flexWrap: "wrap", rowGap: 12 }}>
          <Stat
            value={banner.sentToday}
            label="Sent today"
            sub={banner.stillToGoToday > 0 ? `${banner.stillToGoToday} still to go` : "Nothing else due today"}
            first
          />
          <Stat value={queuedNow} label="Queued ahead" sub={nextSendLabel(banner.nextSendAt)} />
          <Stat value={needsTotal} label="Need attention" sub={needsTotal > 0 ? "See below" : "All clear"} alert={needsTotal > 0} />
          <Stat value={banner.activeFiles} label="Files monitored" sub="Automated" />
        </div>
      </div>
    </GlassCard>
  );
}

function Stat({
  value, label, sub, alert, first,
}: {
  value: number; label: string; sub: string; alert?: boolean; first?: boolean;
}) {
  return (
    <div
      style={{
        padding: "0 20px",
        borderLeft: first ? "none" : "1px solid var(--agent-border-subtle, rgba(15,23,42,0.08))",
        display: "flex", flexDirection: "column", justifyContent: "center",
      }}
    >
      <span style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, fontVariantNumeric: "tabular-nums", color: alert ? "var(--agent-warning)" : "var(--agent-text-primary)" }}>
        {value.toLocaleString()}
      </span>
      <span style={{ fontSize: 11.5, color: "var(--agent-text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{sub}</span>
    </div>
  );
}
