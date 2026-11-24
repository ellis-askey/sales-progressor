"use client";

// Hub — EVERYTHING LEFT. The deeper layer the primitive sweep didn't reach: the inline
// hub-view cards (PipelineHealth / ServiceSplit / ClientsBreakdown / ExchangeForecast),
// their bespoke stat cells + mini-table, Wins/Diary, the empty states, banners, and the
// shell chrome. Left = shipped byte-for-byte; right = canonical (fix) or "register as-is".
// Dev-only, read-only.

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { notFound } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react";
import { buttonClasses } from "@/components/arc/button/button";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";
type Tag = "fix" | "register" | "decision";
const TAGS: Record<Tag, { label: string; fg: string; bg: string; bd: string }> = {
  fix: { label: "Canon fix", fg: "#b45309", bg: "rgba(224,148,46,0.14)", bd: "rgba(224,148,46,0.34)" },
  register: { label: "Register (no visual change)", fg: "#15803d", bg: "rgba(22,163,74,0.12)", bd: "rgba(22,163,74,0.30)" },
  decision: { label: "Decision", fg: "#b91c1c", bg: "rgba(185,28,28,0.11)", bd: "rgba(185,28,28,0.30)" },
};
function TagEl({ k }: { k: Tag }) {
  const t = TAGS[k];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, whiteSpace: "nowrap" }}>{t.label}</span>;
}
function Pane({ side, children }: { side: "current" | "proposed"; children: ReactNode }) {
  const isP = side === "proposed";
  return (
    <div style={{ flex: "1 1 320px", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isP ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>{isP ? "Proposed — canonical" : "Current — shipped (byte-for-byte)"}</span>
      <div style={{ borderRadius: 16, padding: 20, background: "var(--compare-pane)", border: isP ? `1.5px solid ${CORAL}` : "1px solid var(--compare-line)", minHeight: 56 }}>{children}</div>
    </div>
  );
}
function Block({ n, title, tags, note, current, proposed }: { n: string; title: string; tags: Tag[]; note: ReactNode; current: ReactNode; proposed: ReactNode }) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "24px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        {tags.map((k) => <TagEl key={k} k={k} />)}
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.5, maxWidth: 880 }}>{note}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane side="current">{current}</Pane>
        <Pane side="proposed">{proposed}</Pane>
      </div>
    </section>
  );
}

// Proposed canonical stat-cell: StatNumber with a "sm" (24px) size — the secondary stat tier.
function StatCellCanon({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <span style={{ fontSize: 24, fontWeight: 750, color: color ?? "var(--agent-text-primary)", lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.3, marginTop: 3 }}>{label}</span>
    </div>
  );
}

export default function HubRemainingPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("light");
  const restore = useRef<string | null>(null);
  useEffect(() => { const h = document.documentElement; if (restore.current === null) restore.current = h.getAttribute("data-theme"); h.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => () => { const h = document.documentElement; if (restore.current) h.setAttribute("data-theme", restore.current); else h.removeAttribute("data-theme"); }, []);

  const vars = {
    ["--compare-ink" as string]: theme === "dark" ? "#f1ece6" : "#20242E",
    ["--compare-body" as string]: theme === "dark" ? "rgba(241,236,230,0.70)" : "#5b5349",
    ["--compare-muted" as string]: theme === "dark" ? "rgba(241,236,230,0.55)" : "#9a938a",
    ["--compare-faint" as string]: theme === "dark" ? "rgba(241,236,230,0.4)" : "#b3a99d",
    ["--compare-line" as string]: theme === "dark" ? "rgba(255,255,255,0.09)" : "#e7e2db",
    ["--compare-pane" as string]: theme === "dark" ? "rgba(255,255,255,0.03)" : "#faf8f5",
    ["--compare-bg" as string]: theme === "dark" ? "#17140f" : "#F4F2EF",
  } as CSSProperties;
  const toggle = (a: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: a ? CORAL : "transparent", color: a ? "#fff" : "var(--compare-body)" });

  // byte-for-byte current stat cell (hub-view PipelineHealthCard, fontSize:24/800)
  const cellCur = (v: string, l: string, c?: string) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <span style={{ fontSize: 24, fontWeight: 800, color: c ?? "var(--agent-text-primary)", lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{v}</span>
      <span style={{ fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.3, marginTop: 3 }}>{l}</span>
    </div>
  );

  return (
    <div className="agent-shell-root nv2-night" data-theme={theme} style={{ ...vars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Hub — everything left</strong>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button type="button" style={toggle(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={toggle(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 120px" }}>
        <header style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Design system · hub · everything left</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>The deeper layer — cards, stat cells, chrome</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 900 }}>
            The content primitives are done. This is what the primitive sweep didn't reach: four cards defined <strong>inline in hub-view</strong>, their bespoke stat cells + mini-table, Wins/Diary, the empty states, banners, and the app shell. Most are canonical compositions that just need <strong>registering</strong> (no visual change); a couple are genuine <strong>canon fixes</strong>; the shell is a <strong>scope decision</strong>.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{(["fix", "register", "decision"] as Tag[]).map((k) => <TagEl key={k} k={k} />)}</div>
        </header>

        <h2 style={{ margin: "26px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>A · Canon fixes (real visual change)</h2>

        <Block n="A1" title="Pipeline-health stat cells — bespoke 24/800" tags={["fix"]}
          note={<>The "Active files / Exchanging soon / Need attention / Pipeline value" numbers are inline <strong>24px / 800</strong> in hub-view — a <em>secondary</em> stat tier, smaller than the 30px StatBlock hero. Proposal: give <code>StatNumber</code> a <code>size</code> prop (<strong>sm = 24</strong>, md = 30) so both tiers are one component. Weight settles to 750 to match StatNumber.</>}
          current={<div style={{ display: "flex", gap: 24 }}>{cellCur("100", "Active files", "var(--agent-coral-deep)")}{cellCur("79", "Need attention", "var(--agent-warning)")}{cellCur("£51.62m", "Pipeline value")}</div>}
          proposed={<div style={{ display: "flex", gap: 24 }}><StatCellCanon value="100" label="Active files" color="var(--agent-coral-deep)" /><StatCellCanon value="79" label="Need attention" color="var(--agent-warning)" /><StatCellCanon value="£51.62m" label="Pipeline value" /></div>} />

        <Block n="A2" title="Client 'Set fee' link — plain agent-link" tags={["fix"]}
          note={<>In ClientsBreakdown, "Set fee" is a plain <code>agent-link</code> that spreads the hover underline — same issue as View files / Show all. → canonical coral glide-link (<code>agent-arrow-i</code>, no underline).</>}
          current={<a className="agent-link" href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, fontWeight: 600 }}>Set fee</a>}
          proposed={<a className="agent-link" href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center" }}>Set fee <ArrowRight size={11} weight="bold" className="agent-arrow-i" /></a>} />

        <h2 style={{ margin: "40px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>B · Inline hub-view cards → register (canonical compositions)</h2>

        <Block n="B1" title="The four inline cards + Wins + Diary" tags={["register"]}
          note={<>PipelineHealth, ExchangeForecast, ServiceSplit, ClientsBreakdown are defined <strong>inline in hub-view</strong>; WinsCard + DiaryCard are real components. All are <strong>GlassCard + agent-eyebrow + agent-card-subtitle + canonical primitives</strong> (StatNumber, Donut, HeatBand, the de-washed service row). No visual change — they just need a gallery entry each so the whole card layer is findable. <em>(ClientsBreakdown's mini-table is the one bespoke sub-pattern — see B2.)</em></>}
          current={<div style={{ fontSize: 12.5, color: "var(--compare-body)", lineHeight: 1.9 }}>• PipelineHealthCard · • ExchangeForecastCard · • ServiceSplitCard · • ClientsBreakdownCard · • WinsCard · • DiaryCard<br /><span style={{ color: "var(--compare-muted)" }}>GlassCard shells + canonical primitives, inline in hub-view / their own files</span></div>}
          proposed={<div style={{ fontSize: 12.5, color: "var(--compare-body)", lineHeight: 1.9 }}>Six gallery entries under <strong>cards</strong>:<br /><code>hub-pipeline-health</code> · <code>hub-exchange-forecast</code> · <code>hub-service-split</code> · <code>hub-clients</code> · <code>hub-wins</code> · <code>hub-diary</code><br /><span style={{ color: CORAL }}>register only — pixels unchanged</span></div>} />

        <Block n="B2" title="Client mini-table" tags={["register", "decision"]}
          note={<>ClientsBreakdown renders a small inline table (Client / Active / Pipeline / Your fee — uppercase 10px header, 13px tabular rows, hairline separators). It's a clean, consistent pattern but currently hand-rolled. <em>Decision:</em> extract a canonical <code>MiniTable</code> (it'd be reusable), or catalogue the pattern as-is?</>}
          current={<div style={{ width: 300, fontSize: 13 }}>
            <div style={{ display: "flex", gap: 10, paddingBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)", fontWeight: 600 }}>Client</span>
              <span style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)", fontWeight: 600, minWidth: 54, textAlign: "right" }}>Active</span>
              <span style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)", fontWeight: 600, minWidth: 56, textAlign: "right" }}>Your fee</span>
            </div>
            {["Dawson Hart", "Keller Williams"].map((c) => (
              <div key={c} style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: "0.5px solid var(--agent-border-subtle)" }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{c}</span>
                <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", minWidth: 54, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>7</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-coral-deep)", minWidth: 56, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>£2.4k</span>
              </div>
            ))}
          </div>}
          proposed={<div style={{ fontSize: 12.5, color: "var(--compare-body)", lineHeight: 1.7, maxWidth: 300 }}>Either a canonical <code>&lt;MiniTable columns rows /&gt;</code> (reusable across hub/command), or catalogue this exact pattern under <strong>tables</strong>. <span style={{ color: CORAL }}>Your call — it reads clean already.</span></div>} />

        <h2 style={{ margin: "40px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>C · Audit + register</h2>

        <Block n="C1" title="Empty states + banners" tags={["register", "decision"]}
          note={<>Not yet audited or catalogued: the empty states (<code>HubEmptyState</code>, <code>ProgressionOwnerEmptyState</code>, the skeleton-ghost grid — which already uses canonical <code>agent-skeleton</code>) and the three banners (<code>PaymentBlockBanner</code>, <code>PaymentMethodNudge</code>, <code>EmailSetupPrompt</code>). I need to open each to confirm they're canonical compositions, then register. Shown: a representative banner.</>}
          current={<div className="agent-glass" style={{ padding: "12px 14px", borderRadius: 10, border: "0.5px solid rgba(var(--agent-coral-base-rgb),0.20)", fontSize: 12.5, color: "var(--agent-text-secondary)", maxWidth: 320 }}>Representative banner — needs its real markup audited before I claim it canonical.</div>}
          proposed={<div style={{ fontSize: 12.5, color: "var(--compare-body)", lineHeight: 1.7, maxWidth: 320 }}>Audit each → confirm GlassCard + tokens + arc buttons, fix any bespoke bit, then catalogue (<code>hub-empty</code>, <code>hub-banner-*</code>).</div>} />

        <h2 style={{ margin: "40px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>D · The app shell — scope decision</h2>

        <section style={{ borderTop: "1px solid var(--compare-line)", padding: "24px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>D1</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650 }}>Shell chrome — in scope for "the hub page"?</h3>
            <TagEl k="decision" />
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 900 }}>
            These sit on the hub but belong to the <strong>AgentShell</strong> (they're on every agent page): search <code>⌘K</code>, the All/Mine toggle, dark + contrast toggles, the notification bell, the user menu, "Recently viewed", the "2 Issues" badge, the "New note / New email" dock, the cookie button, toasts.
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 900 }}>
            <strong style={{ color: CORAL }}>Decision:</strong> do you want these audited + catalogued as part of "the hub page", or treated as a <strong>separate shell pass</strong> (they'd otherwise get pulled in when we canonicalise the next page anyway)? My recommendation: shell pass, so "hub page done" means hub <em>content</em>.
          </p>
        </section>

        <section style={{ borderTop: "1px solid var(--compare-line)", padding: "24px 0 0" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 650 }}>So, to truly close the hub</h3>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: "var(--compare-body)", lineHeight: 1.75, maxWidth: 900 }}>
            <li><strong>A1</strong> stat cells → <code>StatNumber size="sm"</code> · <strong>A2</strong> Set-fee → coral glide-link <em>(real fixes)</em></li>
            <li><strong>B1</strong> register the 6 cards · <strong>B2</strong> MiniTable decision</li>
            <li><strong>C1</strong> audit + register empty states + 3 banners</li>
            <li><strong>D1</strong> your call on the shell chrome</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
