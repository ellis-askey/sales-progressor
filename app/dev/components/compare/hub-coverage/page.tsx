"use client";

// Hub — canonical COVERAGE compare. Four read-only sweeps (shell/header · attention
// cards · agency metric cards · motion/role/breakpoint) mapped every element + state
// against the 93 gallery entries. Left is the shipped markup reproduced byte-for-byte;
// right is the canonical / proposed treatment. Dev-only, read-only. No production change.

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { notFound } from "next/navigation";
import { CaretDown, Warning, Clock, X, House } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/arc/button/button";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";
type VW = "desktop" | "tablet" | "mobile";
const VW_W: Record<VW, number | undefined> = { desktop: undefined, tablet: 720, mobile: 380 };
type TagKind = "apply" | "new" | "decision";
const TAG: Record<TagKind, { label: string; fg: string; bg: string; bd: string }> = {
  apply: { label: "Reconcile / migrate", fg: "#8a5a00", bg: "rgba(224,148,46,0.14)", bd: "rgba(224,148,46,0.34)" },
  new:   { label: "New canonical", fg: "#7E22CE", bg: "rgba(126,34,206,0.12)", bd: "rgba(126,34,206,0.30)" },
  decision: { label: "Decision required", fg: "#b91c1c", bg: "rgba(185,28,28,0.11)", bd: "rgba(185,28,28,0.30)" },
};
function Tag({ kind }: { kind: TagKind }) {
  const t = TAG[kind];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, whiteSpace: "nowrap" }}>{t.label}</span>;
}
function Pane({ side, vw, children }: { side: "current" | "proposed"; vw: VW; children: ReactNode }) {
  const isP = side === "proposed";
  const w = VW_W[vw];
  return (
    <div style={{ flex: "1 1 340px", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isP ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>{isP ? "Proposed" : "Current (shipped)"}</span>
      <div style={{ borderRadius: 16, padding: 18, background: "var(--compare-pane)", border: isP ? `1.5px solid ${CORAL}` : "1px solid var(--compare-line)", display: "flex", justifyContent: "center" }}>
        <div style={{ width: w ? `min(${w}px, 100%)` : "100%", minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
function Block({ n, title, tags, note, source, vw, current, proposed }: { n: string; title: string; tags: TagKind[]; note: ReactNode; source?: string; vw: VW; current: ReactNode; proposed: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "28px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        {tags.map((k) => <Tag key={k} kind={k} />)}
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}>{note}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane side="current" vw={vw}>{current}</Pane>
        <Pane side="proposed" vw={vw}>{proposed}</Pane>
      </div>
      {source && (
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--compare-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <CaretDown size={11} weight="bold" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} /> Source
          </button>
          {open && <div style={{ marginTop: 8, fontSize: 12, color: "var(--compare-body)", background: "var(--compare-pane)", border: "1px solid var(--compare-line)", borderRadius: 10, padding: "10px 12px" }}><code>{source}</code></div>}
        </div>
      )}
    </section>
  );
}

/* ── The real hub card header (byte-for-byte from HubListCard) ─────────────── */
function HubCardHeader({ icon, color, count, word, sub }: { icon: ReactNode; color: string; count: number; word: string; sub: string }) {
  return (
    <button type="button" className="agent-hover-ctl" style={{ width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, border: "none", borderBottom: "0.5px solid var(--agent-border-subtle)", cursor: "pointer", textAlign: "left" }}>
      <span aria-hidden style={{ color, display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="agent-card-title-emphasis" style={{ margin: 0, display: "block" }}><span style={{ color, fontWeight: 700 }}>{count}</span> {word}</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}>{sub}</span>
      </span>
      <span aria-hidden style={{ color: "var(--agent-text-muted)", display: "flex", transform: "rotate(180deg)", flexShrink: 0 }}><CaretDown size={14} weight="bold" /></span>
    </button>
  );
}
function Thumb() {
  return <span style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--agent-surface-muted, rgba(45,24,16,0.05))", color: "var(--agent-text-muted)" }}><House size={18} weight="fill" /></span>;
}
/* A faithful mini sparkline (hand-rolled SVG, same anatomy as ExchangeSparkline). */
function Spark({ pts = [8, 10, 7, 12, 9, 14, 11, 16] }: { pts?: number[] }) {
  const w = 180, h = 44, max = Math.max(...pts), min = Math.min(...pts);
  const x = (i: number) => (i / (pts.length - 1)) * w;
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * (h - 6) - 3;
  const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={CORAL} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1])} r={3.5} fill={CORAL} />
    </svg>
  );
}

export default function HubCoveragePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("light");
  const [vw, setVw] = useState<VW>("desktop");
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
  const toggleBtn = (active: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: active ? CORAL : "transparent", color: active ? "#fff" : "var(--compare-body)" });

  // Shared: the byte-for-byte hub "file at risk" card (header + one row).
  const riskCard = (
    <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      <HubCardHeader icon={<Warning size={24} weight="regular" />} color="var(--agent-danger, #C73E3E)" count={1} word="file at risk" sub="Our overnight checks have flagged sales that may have stalled." />
      <div className="agent-hover-row" style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px 12px 17px", borderLeft: "3px solid var(--agent-danger, #C73E3E)" }}>
        <Thumb />
        <div style={{ minWidth: 0, flex: "1 1 220px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>20 Williamson Way, Pitstone, LU7 9FU</span>
            <Pill glass tone="danger" size="md">Ready but frozen</Pill>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>Ready to exchange since 5 Oct. Nothing has moved in 46 days.</p>
        </div>
        <button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}><X size={12} weight="bold" /> Dismiss</button>
      </div>
    </div>
  );

  return (
    <div className="agent-shell-root nv2-night" data-theme={theme} style={{ ...pageVars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Hub — coverage compare</strong>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button type="button" style={toggleBtn(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={toggleBtn(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>{(["desktop", "tablet", "mobile"] as VW[]).map((v) => <button key={v} type="button" style={toggleBtn(vw === v)} onClick={() => setVw(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 120px" }}>
        <header style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Design system · coverage · hub</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>Hub — is it covered?</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 880 }}>
            Verdict: <strong>the shell is largely canonical; the hub body is mostly bespoke.</strong> The cards share one uncatalogued baked-glass shell + a collapsible header hand-rolled in six files, the property row is copy-pasted ×6, there’s a hand-rolled SVG chart with no canonical chart entry, the status label is the live toned <strong>text</strong> (pills retired) and just needs cataloguing + consolidating, one count pill uses a faded wash, and the agent-app <code>agent-btn</code> is outdated — buttons migrate to the arc Button. Left is shipped byte-for-byte; right is proposed. Nothing changes production.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{(["apply", "new", "decision"] as TagKind[]).map((k) => <Tag key={k} kind={k} />)}</div>
        </header>

        {/* ── RECONCILE ─────────────────────────────────────────────────────── */}
        <h2 style={{ margin: "26px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Reconcile — inconsistencies &amp; a faded fill</h2>

        <Block n="R1" title="Status label — the toned TEXT is canonical (pills are retired)" tags={["apply"]} vw={vw}
          source="agent-system.css: .hub-pill-d/.attn-pill-d { display:none } · .hub-label-m/.attn-label-m (the live text)"
          note={<>Corrected (I had this backwards): the pills were <strong>retired</strong> — the CSS hides <code>.hub-pill-d</code>/<code>.attn-pill-d</code> at every breakpoint and shows the <strong>toned text label</strong>, so the live hub already reads as text (your screenshot). Proposed: make that the canonical status label (tone carries the meaning), use the same treatment across <em>all</em> the attention cards (Files-to-review / Stalled already do), and delete the now-dead hidden <code>&lt;Pill&gt;</code> JSX. No visual change — this confirms + consolidates what ships.</>}
          current={
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 10.5, fontWeight: 750, color: "var(--agent-danger)" }}>Ready but frozen</span>
              <span style={{ fontSize: 10.5, fontWeight: 750, color: "var(--agent-warning)" }}>On hold</span>
              <span style={{ fontSize: 10.5, fontWeight: 750, color: "var(--agent-danger)" }}>Needs assigning</span>
            </div>
          }
          proposed={
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 10.5, fontWeight: 750, color: "var(--agent-danger)" }}>Ready but frozen</span>
              <span style={{ fontSize: 10.5, fontWeight: 750, color: "var(--agent-warning)" }}>On hold</span>
              <span style={{ fontSize: 10.5, fontWeight: 750, color: "var(--agent-danger)" }}>Needs assigning</span>
            </div>
          }
        />

        <Block n="R2" title="Diary “N events today” pill — drop the faded wash" tags={["apply"]} vw={vw}
          source="DiaryCard.tsx:97-105 (gradient wash fill)"
          note={<>The diary count pill fronts a <strong>faded gradient wash</strong> (<code>rgba(…,0.20)→0.07</code> + inset highlight) — against the no-faded-fills rule, and not the canonical Pill/count-badge. Proposed: the canonical Pill (outline/glass), no wash.</>}
          current={<span style={{ display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, color: "var(--agent-coral-deep)", background: "linear-gradient(180deg, rgba(255,107,74,0.20), rgba(255,107,74,0.07))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }}>3 events today</span>}
          proposed={<Pill glass tone="brand" size="sm">3 events today</Pill>}
        />

        <Block n="R3" title="Loading skeleton mis-previews the real card" tags={["apply"]} vw={vw}
          source="hub-view.tsx:474-504 (ghost) vs HubListCard header"
          note={<>The “ghost attention” skeleton uses a <strong>Clock icon + space-between</strong> header, but the real card header is a <strong>Warning icon + column</strong> layout — so the skeleton previews the wrong shape, causing a layout jump on load. Proposed: the skeleton mirrors the real header anatomy.</>}
          current={
            <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}><Clock size={20} color="var(--agent-text-muted)" /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-muted)" }}>Needs your attention</span></span>
              <span style={{ width: 90, height: 10, borderRadius: 6, background: "var(--agent-surface-muted, rgba(45,24,16,0.06))" }} />
            </div>
          }
          proposed={
            <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <Warning size={24} color="var(--agent-text-muted)" />
              <span style={{ flex: 1 }}><span style={{ display: "block", width: 120, height: 11, borderRadius: 6, background: "var(--agent-surface-muted, rgba(45,24,16,0.08))" }} /><span style={{ display: "block", width: 180, height: 8, borderRadius: 6, marginTop: 6, background: "var(--agent-surface-muted, rgba(45,24,16,0.05))" }} /></span>
              <CaretDown size={14} color="var(--agent-text-muted)" />
            </div>
          }
        />

        {/* ── NEW CANONICAL ─────────────────────────────────────────────────── */}
        <h2 style={{ margin: "36px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>New canonical candidates</h2>

        <Block n="N1" title="Hub attention card — shell + collapsible header" tags={["new"]} vw={vw}
          source="HubListCard / AttentionCard / ReviewsDueCard / ExchangeOverdueCard / StalledEnquiriesCard / NeedsFilingCard (×6)"
          note={<>The real “1 file at risk” card, byte-for-byte: baked-glass <code>GlassCard</code> + a header (24px tinted icon · count-in-title · subtitle · rotating chevron) + a de-washed accent row. This exact shell + header is <strong>hand-rolled in six files</strong> and isn’t a catalogued primitive (it’s <em>not</em> <code>card-main</code> or <code>collapsible-section</code>). Proposed: extract one shared <strong>HubCard</strong> so the 6 cards stop hand-rolling the same shell — a pure code-dedup; <strong>nothing about the layout or look changes</strong> (each card keeps its own copy, which is why some run longer). Current = proposed by design.</>}
          current={riskCard}
          proposed={riskCard}
        />

        <Block n="N2" title="Hub property row (+ splitAddress dedup)" tags={["new"]} vw={vw}
          source="HubListCard row · splitAddress copy-pasted into 5 files"
          note={<>The thumb + address (with the responsive full/line+location split) + accent bar + pill + Dismiss. The <code>splitAddress</code> helper is <strong>copy-pasted into five card files</strong>, each flagged “grandfathered per-component”. Proposed: one canonical HubRow + a single shared splitAddress — behaviour preserved, including the <strong>responsive address split</strong> (town/postcode drops to smaller text under line 1 at narrow widths — switch the viewport above to see it). Current = proposed by design.</>}
          current={
            <div className="agent-hover-row" style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px 12px 17px", borderLeft: "3px solid var(--agent-warning, #C97D1A)", borderRadius: 8 }}>
              <Thumb />
              <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Unit 1, Robins Wharf, Northfleet, DA11 9AX</span><Pill glass tone="warning" size="md">On hold</Pill></div>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>Due back 8 days ago · Placed by Ellis Askey</p>
              </div>
            </div>
          }
          proposed={
            <div className="agent-hover-row" style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px 12px 17px", borderLeft: "3px solid var(--agent-warning, #C97D1A)", borderRadius: 8 }}>
              <Thumb />
              <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Unit 1, Robins Wharf, Northfleet, DA11 9AX</span><Pill glass tone="warning" size="md">On hold</Pill></div>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>Due back 8 days ago · Placed by Ellis Askey</p>
              </div>
            </div>
          }
        />

        <Block n="N3" title="Split-button (“Take off hold ▾”)" tags={["new"]} vw={vw}
          source="AttentionCard / ReviewsDueCard — agent-btn + joined RowActionMenu"
          note={<>A primary action joined to a caret that opens a menu (wait a week · pick a date · withdraw). The menu rides the canonical <code>menu-popover</code> + <code>pick-row</code>, but the <strong>joined split-button shape is bespoke</strong> and hand-built in several cards. Proposed: catalogue one split-button.</>}
          current={
            <div style={{ display: "inline-flex" }}>
              <button className="agent-btn agent-btn-sm" style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>Take off hold</button>
              <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1, padding: "0 8px" }}><CaretDown size={12} weight="bold" /></button>
            </div>
          }
          proposed={
            <div style={{ display: "inline-flex" }}>
              <button className="agent-btn agent-btn-sm" style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>Take off hold</button>
              <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1, padding: "0 8px" }}><CaretDown size={12} weight="bold" /></button>
            </div>
          }
        />

        <Block n="N4" title="Exchange sparkline — no chart primitive exists" tags={["new"]} vw={vw}
          source="components/hub/ExchangeSparkline.tsx (hand-rolled SVG)"
          note={<>A hand-rolled SVG line chart (polyline + endpoint dot + dashed scrub line + body-portaled tooltip + ResizeObserver real-pixel sizing). <strong>The gallery has no chart/sparkline/trend entry at all</strong> — the single biggest primitive gap on the hub. Proposed: catalogue a sparkline/trend primitive (and align with the dataviz guidance).</>}
          current={<Spark />}
          proposed={<Spark />}
        />

        <Block n="N5" title="Pipeline-health stat cell" tags={["new"]} vw={vw}
          source="hub-view.tsx:1063-1145 (hub-stats-grid) — NOT hero-stat-cell"
          note={<>A 4-cell grid of value + label + delta + sub with a left-border divider and no icon. Presented as if it were <code>hero-stat-cell</code>, but it isn’t (that one is icon + 15px value, 2-col, no delta/divider). Proposed: catalogue the hub stat cell as its own primitive — <strong>current and proposed are identical by design</strong> (catalogue-as-is, no visual change; it just needs its own gallery entry).</>}
          current={
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              {[["Active sales", "24", "+3 this month", "var(--agent-success)"], ["Exchanging", "6", "£2.1m closing", "var(--agent-text-muted)"]].map(([l, v, d, dc], i) => (
                <div key={l} style={{ padding: "10px 16px", borderLeft: i % 2 ? "1px solid var(--agent-border-subtle)" : "none" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 }}>{l}</div>
                  <div style={{ fontSize: 10.5, color: dc as string, marginTop: 2 }}>{d}</div>
                </div>
              ))}
            </div>
          }
          proposed={
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              {[["Active sales", "24", "+3 this month", "var(--agent-success)"], ["Exchanging", "6", "£2.1m closing", "var(--agent-text-muted)"]].map(([l, v, d, dc], i) => (
                <div key={l} style={{ padding: "10px 16px", borderLeft: i % 2 ? "1px solid var(--agent-border-subtle)" : "none" }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 }}>{l}</div>
                  <div style={{ fontSize: 10.5, color: dc as string, marginTop: 2 }}>{d}</div>
                </div>
              ))}
            </div>
          }
        />

        {/* ── DECISION ──────────────────────────────────────────────────────── */}
        <h2 style={{ margin: "36px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>The big decision</h2>

        <Block n="D1" title="Buttons → align the whole app to the arc Button" tags={["apply"]} vw={vw}
          source="agent-btn* (agent app, outdated) → components/arc/button (the /dev/components canonical)"
          note={<>Decided: <code>agent-btn</code> is outdated — primary / secondary / ghost migrate to the <strong>arc Button</strong> from /dev/components (coral primary via token override, secondary peer, quiet ghost). Left = today’s <code>agent-btn</code>; right = the arc Button. This is a <strong>large, app-wide migration</strong> (hundreds of call sites across every surface), so it runs as a phased, per-surface pass — I’d start with the hub, one card at a time, each verified. Not a single sweep (that would break things).</>}
          current={<div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}><button className="agent-btn agent-btn-primary">Set up my email</button><button className="agent-btn agent-btn-ghost-bordered">Dismiss</button></div>}
          proposed={
            <div className="arc-scope" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Button variant="primary" size="md" style={{ ["--foreground" as string]: CORAL, ["--background" as string]: "#fff" } as CSSProperties}>Set up my email</Button>
              <Button variant="secondary" size="md">Secondary</Button>
              <Button variant="ghost" size="md">Dismiss</Button>
            </div>
          }
        />

        {/* ── STRUCTURAL / BEHAVIOURAL ──────────────────────────────────────── */}
        <section style={{ borderTop: "1px solid var(--compare-line)", paddingTop: 26, marginTop: 8 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Also found — behavioural / structural (not pixel-rendered)</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--compare-body)", maxWidth: 880 }}>These are motion, data, or role-driven and need their own live state to render true. Each is a known candidate; I’ll build a dedicated compare for any you want before touching it.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["Section entrance motion", "SectionReveal (order×50ms stagger, glass-frost-safe fade/rise split) + AnimatedSection (auto-animate card reflow). Only the 520ms duration is in motion-tokens; comment says 40ms, code uses 50ms.", "Catalogue the hub section-reveal + reflow motion; fix the 40/50ms drift."],
              ["Skeleton loading system", "SectionSkeleton reserve-height + agent-skeleton shimmer. The gallery loading-states is login-spinner-buttons only; this 'reserve height, bloom in' model is uncatalogued.", "Catalogue the skeleton/reserve-space loading system."],
              ["Pipeline stage cards", "ReachedCard / UpNextCard / GhostCard — tinted-glass stage faces with progressive reveal (reached / up-next / ghost-locked).", "Catalogue the pipeline stage card + its three states."],
              ["WinsCard story engine", "Tier-keyed bare icon + rotating slide spotlight (32/700 number) + widening dot-pagination + swipe/auto-rotate.", "Catalogue the rotating-spotlight card."],
              ["Third hero (FirstSaleHero)", "A distinct welcome hero alongside empty-hero and onboarding-hero; bespoke CTAs + 'Added via chain' chip.", "Catalogue, or fold into the hero family."],
              ["Empty-state duplication", "ProgressionOwnerEmptyState hand-rolls the empty-hero markup inline instead of sharing it; progressor empty state bypasses GlassCard entirely.", "Share one Hero component."],
              ["Card-internal header", "agent-card-hdr-internal + agent-card-subtitle — the in-card eyebrow+subtitle block, used by many cards, uncatalogued (only page-header is).", "Catalogue the card header block."],
              ["TypedText typewriter + AgentFlagButton composer", "The greeting typewriter (+ caret) and the 'expand a trigger into an inline composer + Sent chip' pattern — both reusable, both uncatalogued.", "Catalogue both."],
              ["Payment / trial banners", "PaymentBlockBanner + TrialBannerWithModal — a recurring glass-inset alert banner not covered by banner-card or inline-alert.", "Catalogue the alert-banner material."],
            ].map(([t, now, prop]) => (
              <div key={t} style={{ display: "grid", gridTemplateColumns: "210px 1fr 1fr", gap: 14, alignItems: "start", background: "var(--compare-pane)", border: "1px solid var(--compare-line)", borderRadius: 10, padding: "11px 14px" }}>
                <strong style={{ fontSize: 12.5 }}>{t}</strong>
                <span style={{ fontSize: 12, color: "var(--compare-body)", lineHeight: 1.5 }}>{now}</span>
                <span style={{ fontSize: 12, color: "var(--compare-body)", lineHeight: 1.5 }}><span style={{ color: CORAL, fontWeight: 700 }}>→ </span>{prop}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── CONFIRMED ─────────────────────────────────────────────────────── */}
        <section style={{ borderTop: "1px solid var(--compare-line)", paddingTop: 26, marginTop: 8 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Confirmed covered</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              "The whole shell is canonical: top bar, nav rail, ⌘K search, All/Mine view-toggle, As-of refresh, theme/aurora/flask icon-controls, notification bell + count-badge, account menu + avatar, quick-action dock, brand mark.",
              "Page header (title + subtitle) = canonical page-header.",
              "Eyebrows render the decided 10px sentence-case token — matches canonical.",
              "Desktop status pills in Attention + Files-at-risk use the canonical Pill (the inconsistency is only mobile + the other two cards — R1).",
              "The split-button and overflow menus ride the canonical menu-popover + pick-row.",
              "Empty state (agency) = empty-hero + info-card + banner-card; EmailSetupPrompt = banner-card.",
              "GlassCard is the shared surface (one note to reconcile: hub uses defaultVariant v05, the card-main entry documents v04).",
            ].map((c) => (
              <div key={c} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--compare-pane)", border: "1px solid rgba(47,158,107,0.32)", borderRadius: 10, padding: "9px 13px" }}>
                <span style={{ color: "#1f7a4d", flexShrink: 0, fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: 12.5, color: "var(--compare-body)", lineHeight: 1.5 }}>{c}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
