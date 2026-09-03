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

  return (
    <GlassCard
      glassId="auto-emails-banner"
      label="Auto emails · Health"
      defaultVariant="v05"
      style={{ padding: "16px 22px", borderRadius: "var(--agent-radius-xl)", marginBottom: 16 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        {/* Health lead */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              display: "grid", placeItems: "center",
              background: paused ? "var(--agent-warning-bg)" : "var(--agent-success-bg)",
              color: paused ? "var(--agent-warning)" : "var(--agent-success)",
            }}
          >
            {paused ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg>
            )}
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>
              {paused ? "Automation paused" : "Automation healthy"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>
              {paused
                ? "Chases aren't sending right now."
                : `We're monitoring and chasing ${banner.activeFiles} active ${fileWord}.`}
            </p>
          </div>
        </div>

        {/* Stat strip */}
        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap" }}>
          <Stat value={queuedNow} label="Queued to send" sub={nextSendLabel(banner.nextSendAt)} first />
          <Stat value={banner.chasingTodayCount} label="Chasing today" sub={`Across ${banner.chasingTodayFiles} ${banner.chasingTodayFiles === 1 ? "file" : "files"}`} />
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
