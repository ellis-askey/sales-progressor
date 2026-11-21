"use client";

// Hub — FINAL canonical audit. Everything still hand-rolled on the hub page, rendered
// byte-for-byte (real shipped classes) on the left, with the canonical replacement on the
// right. This is the "fully production-ready, no bespoke" sweep. Dev-only, read-only.

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { notFound } from "next/navigation";
import { X, Envelope, Check, NotePencil, ChartLineUp } from "@phosphor-icons/react";
import { buttonClasses } from "@/components/arc/button/button";
import { Pill } from "@/components/ui/Pill";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
const CORAL_TOKENS = { ["--foreground" as string]: "#FF6B4A", ["--background" as string]: "#ffffff" } as CSSProperties;
type Theme = "light" | "dark";
type TagKind = "replace" | "newcanon" | "decision";
const TAG: Record<TagKind, { label: string; fg: string; bg: string; bd: string }> = {
  replace: { label: "Replace w/ canonical", fg: "#b45309", bg: "rgba(224,148,46,0.14)", bd: "rgba(224,148,46,0.34)" },
  newcanon: { label: "Needs new canonical", fg: "#7E22CE", bg: "rgba(126,34,206,0.12)", bd: "rgba(126,34,206,0.30)" },
  decision: { label: "Decision", fg: "#b91c1c", bg: "rgba(185,28,28,0.11)", bd: "rgba(185,28,28,0.30)" },
};
function Tag({ kind }: { kind: TagKind }) {
  const t = TAG[kind];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, whiteSpace: "nowrap" }}>{t.label}</span>;
}
function Pane({ side, children }: { side: "current" | "proposed"; children: ReactNode }) {
  const isP = side === "proposed";
  return (
    <div style={{ flex: "1 1 320px", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isP ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>{isP ? "Proposed — canonical" : "Current — shipped (byte-for-byte)"}</span>
      <div style={{ borderRadius: 16, padding: 20, background: "var(--compare-pane)", border: isP ? `1.5px solid ${CORAL}` : "1px solid var(--compare-line)", display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", minHeight: 60 }}>{children}</div>
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
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}><strong>What's bespoke:</strong> {why}</p>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}><strong style={{ color: CORAL }}>Canonical:</strong> {rec}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane side="current">{current}</Pane>
        <Pane side="proposed">{proposed}</Pane>
      </div>
    </section>
  );
}

export default function HubAuditFinalPage() {
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
        <strong style={{ fontSize: 14 }}>Hub — final canonical audit</strong>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button type="button" style={toggle(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={toggle(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 120px" }}>
        <header style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Design system · hub · final audit</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>Everything still hand-rolled on the hub</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 900 }}>
            Buttons are now largely arc, but a full sweep found more bespoke pieces. Each is below, <strong>byte-for-byte as it ships</strong> vs the canonical replacement. Three kinds: <strong>replace with an existing canonical</strong>, <strong>needs a new canonical built</strong> (charts), and a couple of <strong>decisions</strong>.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{(["replace", "newcanon", "decision"] as TagKind[]).map((k) => <Tag key={k} kind={k} />)}</div>
        </header>

        <Block n="A1" title="Dismiss / Close / ✕ → canonical circle-X — APPLIED" tags={["replace"]}
          why={<>The hub had <strong>three</strong> ways to dismiss: a labelled "Dismiss" button, a hand-rolled <code>.hub-r-x</code> mobile ✕, and the <code>.agent-icon-btn</code> "×" close. Three looks for one gesture.</>}
          rec={<><strong>Decided:</strong> the canonical is <code>.agent-icon-btn</code> — a circular, neutral icon button that fades to a soft circular shade on hover (its CSS literally defines it as the "circular close / dismiss button"). <strong>Not</strong> the coral outline. It's now used for row dismiss (HubListCard) and stays the modal/top-right close; the labelled "Dismiss" and the bespoke <code>.hub-r-x</code> are retired. Hover the proposed one to see the fade.</>}
          current={<>
            <button className={buttonClasses({ variant: "outline", size: "sm" })} style={{ gap: 5 }}><X size={12} weight="bold" /> Dismiss</button>
            <button className="hub-r-x" aria-label="Dismiss" style={{ position: "static", display: "inline-grid", placeItems: "center" }}><X size={14} weight="bold" /></button>
          </>}
          proposed={<button className="agent-icon-btn agent-icon-btn-md" aria-label="Dismiss"><X size={16} weight="bold" /></button>} />

        <Block n="A2" title="NeedsFiling count pills — hand-rolled" tags={["replace"]}
          why={<>Two inline-styled pills (<code>borderRadius:999</code>, coral/teal fills) for "N emails" and the sent/unsent state — the exact wash the canonical <code>Pill</code> exists to replace.</>}
          rec={<>The canonical <code>&lt;Pill glass tone=… size="sm"&gt;</code> with the icon as a child. Tone carries the colour; no inline fill.</>}
          current={<>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 999, color: "var(--agent-coral-deep)", background: "rgba(var(--agent-coral-rgb), 0.10)" }}><Envelope size={10} weight="bold" /> 3 emails</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 600, padding: "1px 7px", borderRadius: 999, color: "#0f766e", background: "rgba(16,185,129,0.12)" }}>Unsent</span>
          </>}
          proposed={<>
            <Pill glass tone="brand" size="sm"><Envelope size={10} weight="bold" /> 3 emails</Pill>
            <Pill glass tone="success" size="sm">Unsent</Pill>
          </>} />

        <Block n="A3" title="BookingsToConfirm — remaining agent-btn" tags={["replace"]}
          why={<>The "Log it" menu trigger (ghost-bordered) and a <code>agent-btn-color-primary</code> action never went through the pilot (they're custom-trigger / nested).</>}
          rec={<><code>buttonClasses(outline)</code> for the trigger, <code>buttonClasses(primary)</code> + coral tokens for the action — same mapping as the rest of the hub.</>}
          current={<>
            <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered">Log it</button>
            <button className="agent-btn agent-btn-sm agent-btn-color-primary">Confirm booking</button>
          </>}
          proposed={<>
            <button className={buttonClasses({ variant: "outline", size: "sm" })}>Log it</button>
            <button className={buttonClasses({ variant: "primary", size: "sm" })} style={CORAL_TOKENS}>Confirm booking</button>
          </>} />

        <Block n="A4" title="DiaryEventRow — expand-panel buttons" tags={["replace"]}
          why={<>The confirm / reschedule panels still use raw <code>agent-btn</code> (Cancel ghost-bordered + Confirm/Save primary). Note: a <code>.diary-row</code> CSS rule gives these an elevated fill so they don't vanish into the diary tint — that rule must move onto the arc classes when they migrate.</>}
          rec={<>arc <code>outline</code> / <code>primary</code>, and re-point the <code>.diary-row</code> elevated-fill rule at the arc class so the diary treatment is preserved.</>}
          current={<>
            <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered">Cancel</button>
            <button className="agent-btn agent-btn-sm agent-btn-primary">Confirm exchange</button>
          </>}
          proposed={<>
            <button className={buttonClasses({ variant: "outline", size: "sm" })}>Cancel</button>
            <button className={buttonClasses({ variant: "primary", size: "sm" })} style={CORAL_TOKENS}>Confirm exchange</button>
          </>} />

        <Block n="A5" title="Charts — ExchangeSparkline + HubCharts (no canonical exists)" tags={["newcanon"]}
          why={<>Two hand-rolled SVG charts (a sparkline + a weekly bar chart) with inline path/rect maths. There is <strong>no canonical chart primitive</strong> in <code>components/ui</code> at all.</>}
          rec={<>Build a canonical <code>Sparkline</code> + <code>BarChart</code> (area fill, faint grid, emphasised endpoint, tabular labels) in the library, then point both hub charts at it. This is its own build — shown here as current vs a canonical sketch.</>}
          current={<svg width={160} height={44}><polyline points="0,38 26,30 52,34 78,20 104,26 130,10 160,4" fill="none" stroke={CORAL} strokeWidth={2} strokeLinecap="round" /><circle cx={160} cy={4} r={3} fill={CORAL} /></svg>}
          proposed={<div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--compare-muted)", fontSize: 12 }}><ChartLineUp size={18} /> canonical <code>Sparkline</code> — area fill + endpoint, catalogued</div>} />

        <Block n="A6" title="Big-number typography — inline, per-component" tags={["decision"]}
          why={<>Hero/stat numbers are inline-styled ad-hoc: PipelineAtAGlance <code>28/800</code>, WinsCard <code>32/700</code>, FirstSaleHero <code>34/800</code>, with per-file eyebrows. No shared stat/numeral type style.</>}
          rec={<>A small set of canonical type tokens (display-stat, eyebrow) so every big number + eyebrow is one scale. <em>Decision:</em> worth a token pass, or leave these as deliberate per-surface sizes?</>}
          current={<div><p style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--agent-text-primary)" }}>42</p><p style={{ margin: 0, fontSize: 32, fontWeight: 700, color: "var(--agent-text-primary)" }}>£1.2m</p></div>}
          proposed={<div style={{ color: "var(--compare-muted)", fontSize: 12 }}><NotePencil size={16} /> one <code>--type-display-stat</code> scale, used by all stat cards</div>} />

        <section style={{ borderTop: "1px solid var(--compare-line)", padding: "26px 0 0" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 650 }}>Also found — not visual, but part of "done"</h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: "var(--compare-body)", lineHeight: 1.75, maxWidth: 900 }}>
            <li><strong>Animations not catalogued</strong> — SectionReveal, AnimatedSection, the HubCard accordion, auto-animate row-removal, LoadingDots. They work but aren't in the library's motion section. <em>Record each.</em></li>
            <li><strong>Library gaps</strong> — the gallery currently has <strong>no hub entries</strong> (hub-card / hub-row / hub-split-button were dropped when I reverted components.tsx for the build fix). Plus the new <code>outline</code>/<code>xs</code>/<code>icon</code> button variants and the icon-button aren't recorded. <em>Re-catalogue all of it.</em></li>
            <li><strong><code>agent-link</code></strong> — the hand-rolled text link is used ~18× (Show all / Cancel / footer links). Decide: promote <code>agent-link</code> as the canonical text-link (catalogue it) or move to a <code>&lt;TextLink&gt;</code> component.</li>
            <li><strong>Dead code</strong> — ExpiredHoldsCard / AttentionListView etc. (replaced by AttentionCard) still carry bespoke buttons. <em>Delete in a sweep, don't migrate.</em></li>
          </ul>
        </section>
      </div>
    </div>
  );
}
