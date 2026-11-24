"use client";

// Hub — dataviz + typography audit (the pieces the button/pill sweep didn't cover). The
// charts are rendered REAL (imported from HubCharts) so nothing is guessed, and the stat
// cards are shown WHOLE for context. Left = shipped, right = the canonical proposal. This
// corrects the earlier miss (the "who's managing" donut + the momentum ring + heat band were
// never in the dataviz audit). Dev-only, read-only.

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowsClockwise, X } from "@phosphor-icons/react";
import { buttonClasses } from "@/components/arc/button/button";
import { ServiceSplitDonut, MomentumRing, ForecastHeatBand } from "@/components/hub/HubCharts";
import type { WeekBucket } from "@/lib/services/hub";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";
type TagKind = "newcanon" | "decision" | "same";
const TAG: Record<TagKind, { label: string; fg: string; bg: string; bd: string }> = {
  newcanon: { label: "Extract to canonical", fg: "#7E22CE", bg: "rgba(126,34,206,0.12)", bd: "rgba(126,34,206,0.30)" },
  decision: { label: "Decision", fg: "#b91c1c", bg: "rgba(185,28,28,0.11)", bd: "rgba(185,28,28,0.30)" },
  same: { label: "Already canonical", fg: "#15803d", bg: "rgba(22,163,74,0.12)", bd: "rgba(22,163,74,0.30)" },
};
function Tag({ kind }: { kind: TagKind }) {
  const t = TAG[kind];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, whiteSpace: "nowrap" }}>{t.label}</span>;
}
function Pane({ side, children }: { side: "current" | "proposed"; children: ReactNode }) {
  const isP = side === "proposed";
  return (
    <div style={{ flex: "1 1 320px", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isP ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>{isP ? "Proposed — canonical" : "Current — shipped (real component)"}</span>
      <div style={{ borderRadius: 16, padding: 20, background: "var(--compare-pane)", border: isP ? `1.5px solid ${CORAL}` : "1px solid var(--compare-line)", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", minHeight: 64 }}>{children}</div>
    </div>
  );
}
function Block({ n, title, tags, why, rec, current, proposed }: { n: string; title: string; tags: TagKind[]; why: ReactNode; rec: ReactNode; current: ReactNode; proposed: ReactNode }) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "26px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        {tags.map((k) => <Tag key={k} kind={k} />)}
      </div>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}><strong>Now:</strong> {why}</p>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}><strong style={{ color: CORAL }}>Canonical:</strong> {rec}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane side="current">{current}</Pane>
        <Pane side="proposed">{proposed}</Pane>
      </div>
    </section>
  );
}

const WEEKS: WeekBucket[] = [
  { label: "This", count: 3, feesPence: 540000, isCurrentWeek: true, files: [{ address: "8 Chandler Court", feePence: 180000 }] },
  { label: "+1w", count: 1, feesPence: 150000, isCurrentWeek: false, files: [] },
  { label: "+2w", count: 0, feesPence: 0, isCurrentWeek: false, files: [] },
  { label: "+3w", count: 2, feesPence: 300000, isCurrentWeek: false, files: [] },
  { label: "+4w", count: 1, feesPence: 120000, isCurrentWeek: false, files: [] },
] as WeekBucket[];

// A proposed canonical stat: one scale (30px / 750 / tabular) + the canonical agent-eyebrow.
function StatCanonical({ eyebrow, big, sub }: { eyebrow: string; big: string; sub: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p className="agent-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</p>
      <p style={{ margin: 0, fontSize: 30, fontWeight: 750, letterSpacing: "-0.02em", lineHeight: 1.05, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{big}</p>
      <p className="agent-card-subtitle" style={{ marginTop: 4 }}>{sub}</p>
    </div>
  );
}

export default function HubDatavizTypePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("light");
  const restore = useRef<string | null>(null);
  useEffect(() => { const h = document.documentElement; if (restore.current === null) restore.current = h.getAttribute("data-theme"); h.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => () => { const h = document.documentElement; if (restore.current) h.setAttribute("data-theme", restore.current); else h.removeAttribute("data-theme"); }, []);

  const pageVars = {
    ["--compare-ink" as string]: theme === "dark" ? "#f1ece6" : "#20242E",
    ["--compare-body" as string]: theme === "dark" ? "rgba(241,236,230,0.70)" : "#5b5349",
    ["--compare-muted" as string]: theme === "dark" ? "rgba(241,236,230,0.55)" : "#9a938a",
    ["--compare-faint" as string]: theme === "dark" ? "rgba(241,236,230,0.4)" : "#b3a99d",
    ["--compare-line" as string]: theme === "dark" ? "rgba(255,255,255,0.09)" : "#e7e2db",
    ["--compare-pane" as string]: theme === "dark" ? "rgba(255,255,255,0.03)" : "#faf8f5",
    ["--compare-bg" as string]: theme === "dark" ? "#17140f" : "#F4F2EF",
  } as CSSProperties;
  const toggle = (active: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: active ? CORAL : "transparent", color: active ? "#fff" : "var(--compare-body)" });

  return (
    <div className="agent-shell-root nv2-night" data-theme={theme} style={{ ...pageVars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Hub — dataviz &amp; typography</strong>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button type="button" style={toggle(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={toggle(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 120px" }}>
        <header style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Design system · hub · dataviz &amp; type</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>The charts I missed, and the stat type</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 900 }}>
            You were right — my dataviz audit was incomplete. The hub has <strong>four</strong> dataviz pieces, not one: the Sparkline (done), the <strong>"who's managing" donut</strong>, a <strong>momentum ring</strong>, and the <strong>forecast heat band</strong>. All three missed are rendered <strong>real</strong> below (imported from HubCharts). Plus A6 — the stat cards shown <strong>whole</strong> for context.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{(["newcanon", "decision", "same"] as TagKind[]).map((k) => <Tag key={k} kind={k} />)}</div>
        </header>

        <Block n="D1" title="Service-split donut — 'Who's managing' (the one I missed)" tags={["newcanon"]}
          why={<>A <strong>recharts</strong> <code>PieChart</code> donut (coral self-progressed vs amber with-us) inlined in HubCharts. Real one on the left.</>}
          rec={<>Wrap it as a canonical <code>components/ui/Donut.tsx</code> (segments + colours + size as props), so every donut in the app is one component. Same pixels; recharts stays the engine.</>}
          current={<div style={{ display: "flex", alignItems: "center", gap: 10 }}><ServiceSplitDonut selfManaged={7} outsourced={3} /><span style={{ fontSize: 12, color: "var(--compare-muted)" }}>recharts, inline</span></div>}
          proposed={<div style={{ display: "flex", alignItems: "center", gap: 10 }}><ServiceSplitDonut selfManaged={7} outsourced={3} /><span style={{ fontSize: 12, color: CORAL }}>&lt;Donut segments=… /&gt;</span></div>} />

        <Block n="D2" title="Momentum ring — the % progress circle" tags={["newcanon"]}
          why={<>A hand-rolled SVG ring (coral stroke, animated <code>stroke-dashoffset</code>, % label centre) in HubCharts.</>}
          rec={<>Extract to a canonical <code>ProgressRing</code> (value + size + label), same as the Sparkline extraction — identical render.</>}
          current={<MomentumRing percent={72} />}
          proposed={<div style={{ display: "flex", alignItems: "center", gap: 10 }}><MomentumRing percent={72} /><span style={{ fontSize: 12, color: CORAL }}>&lt;ProgressRing value=… /&gt;</span></div>} />

        <Block n="D3" title="Forecast heat band — the 5-cell exchange strip" tags={["newcanon", "decision"]}
          why={<>Five glass cells, coral intensity scaled to each week's count, number + label printed in-cell, hover popup. Bespoke in HubCharts (it replaced an old recharts bar chart).</>}
          rec={<>Extract to a canonical <code>HeatBand</code> (cells + intensity + in-cell label). <em>Decision:</em> it's quite hub-specific (fees popup, week phrasing) — extract the generic band and keep the fee copy as a slot, or leave it as a one-off hub chart?</>}
          current={<div style={{ width: 300 }}><ForecastHeatBand data={WEEKS} /></div>}
          proposed={<div style={{ width: 300 }}><ForecastHeatBand data={WEEKS} /></div>} />

        <Block n="D4" title="RefreshButton — bespoke inline button" tags={["newcanon"]}
          why={<>A hand-rolled inline-styled button (Tailwind <code>hover:bg-black/[0.04]</code>, inline padding/colour) for the "updated Xm ago · refresh" control.</>}
          rec={<>The canonical ghost button — <code>buttonClasses(&#123;variant:"ghost", size:"sm"&#125;)</code> with the refresh glyph + label.</>}
          current={<button style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: "var(--agent-text-muted)", fontSize: 11, padding: "4px 8px", borderRadius: 6 }}><ArrowsClockwise size={13} /> Updated 4m ago</button>}
          proposed={<button className={buttonClasses({ variant: "ghost", size: "sm" })} style={{ gap: 5 }}><ArrowsClockwise size={13} /> Updated 4m ago</button>} />

        <h2 style={{ margin: "40px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>A6 · stat typography — whole cards for context</h2>

        <Block n="A6·1" title="PipelineAtAGlance header" tags={["decision"]}
          why={<>Eyebrow is the canonical <code>agent-eyebrow</code> ✓, but the big number is inline <strong>28px / 800</strong>.</>}
          rec={<>One canonical stat scale (<strong>30 / 750 / tabular</strong> shown) so every card's headline number matches. The eyebrow + subtitle are already canonical.</>}
          current={<div style={{ minWidth: 0 }}>
            <p className="agent-eyebrow" style={{ marginBottom: 6 }}>Pipeline at a glance</p>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05, color: "var(--agent-text-primary)" }}>12 active sales</p>
            <p className="agent-card-subtitle" style={{ marginTop: 4 }}>Here&apos;s where every file sits right now.</p>
          </div>}
          proposed={<StatCanonical eyebrow="Pipeline at a glance" big="12 active sales" sub="Here's where every file sits right now." />} />

        <Block n="A6·2" title="WinsCard slide — kicker is ALSO bespoke" tags={["decision"]}
          why={<>Here the kicker is a hand-rolled inline eyebrow (<strong>10.5 / 700 coral</strong>, not <code>agent-eyebrow</code>) and the number is <strong>32px / 700</strong> — different size + weight to PipelineAtAGlance.</>}
          rec={<>Same canonical stat scale + the canonical <code>agent-eyebrow</code>, so Wins and Pipeline read as one family rather than two ad-hoc sizes.</>}
          current={<div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 6px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", color: "var(--agent-coral-deep)" }}>This month</p>
            <p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>£1.2m</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", fontWeight: 500 }}>Exchanged this month</p>
          </div>}
          proposed={<StatCanonical eyebrow="This month" big="£1.2m" sub="Exchanged this month" />} />

        <section style={{ borderTop: "1px solid var(--compare-line)", padding: "26px 0 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>L</span>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "var(--compare-ink)" }}>agent-link — already canonical</h3>
            <Tag kind="same" />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}>Checked: <code>.agent-link</code> is the one shared text-link (coral, darkens to #E55B3D on hover) and is already catalogued as the gallery's "coral text link". The hub's ~18 uses all go through it — no change needed.</p>
        </section>
      </div>
    </div>
  );
}
