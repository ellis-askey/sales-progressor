"use client";

// Hub — the REVEAL LAYER. Every button/control that only appears AFTER you interact (open
// the snooze menu, the assign flow, a chase drawer, a confirm modal). This is where the
// hand-rolled UI was hiding — the static-page audits never reached it. Left = shipped
// (real classes), right = canonical. Dev-only, read-only.

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { notFound } from "next/navigation";
import { Button, buttonClasses } from "@/components/arc/button/button";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
const CORAL_TOKENS = { ["--foreground" as string]: "#FF6B4A", ["--background" as string]: "#ffffff" } as CSSProperties;
type Theme = "light" | "dark";
function Tag({ label, tone }: { label: string; tone: "fix" | "same" }) {
  const c = tone === "fix" ? { fg: "#b45309", bg: "rgba(224,148,46,0.14)", bd: "rgba(224,148,46,0.34)" } : { fg: "#15803d", bg: "rgba(22,163,74,0.12)", bd: "rgba(22,163,74,0.30)" };
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, whiteSpace: "nowrap" }}>{label}</span>;
}
function Pane({ side, children }: { side: "current" | "proposed"; children: ReactNode }) {
  const isP = side === "proposed";
  return (
    <div style={{ flex: "1 1 320px", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isP ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>{isP ? "Proposed — canonical" : "Current — shipped (real class)"}</span>
      <div style={{ borderRadius: 16, padding: 20, background: "var(--compare-pane)", border: isP ? `1.5px solid ${CORAL}` : "1px solid var(--compare-line)", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", minHeight: 56 }}>{children}</div>
    </div>
  );
}
function Block({ n, title, why, rec, current, proposed }: { n: string; title: string; why: ReactNode; rec: ReactNode; current: ReactNode; proposed: ReactNode }) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "24px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        <Tag label="Replace w/ canonical" tone="fix" />
      </div>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.5, maxWidth: 880 }}><strong>Bespoke:</strong> {why}</p>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.5, maxWidth: 880 }}><strong style={{ color: CORAL }}>Canonical:</strong> {rec}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane side="current">{current}</Pane>
        <Pane side="proposed">{proposed}</Pane>
      </div>
    </section>
  );
}

export default function HubRevealLayerPage() {
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
        <strong style={{ fontSize: 14 }}>Hub — reveal layer</strong>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button type="button" style={toggle(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={toggle(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 120px" }}>
        <header style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Design system · hub · reveal layer</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>The buttons that only appear when you interact</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 900 }}>
            The static-page audits never reached these. Open the <strong>snooze menu</strong>, the <strong>assign flow</strong>, a <strong>chase drawer</strong> or a <strong>confirm modal</strong> and the UI is still hand-rolled. Every one below, real on the left, canonical on the right.
          </p>
        </header>

        <Block n="I1" title="Snooze menu — quick-gap chips"
          why={<>The Tomorrow / In&nbsp;2&nbsp;days / In&nbsp;3&nbsp;days chips use a bespoke <code>.rem-snz-chip</code> class — while the canonical segment pill (<code>.agent-segment-pill-sm</code>) already exists for exactly this.</>}
          rec={<>Swap <code>.rem-snz-chip</code> → <code>.agent-segment-pill agent-segment-pill-sm</code> (<code>.on</code> for selected). One selection-pill language app-wide.</>}
          current={<>
            {["Tomorrow", "In 2 days", "In 3 days", "Next week"].map((l, i) => <button key={l} className={`rem-snz-chip${i === 2 ? " on" : ""}`}>{l}</button>)}
          </>}
          proposed={<>
            {["Tomorrow", "In 2 days", "In 3 days", "Next week"].map((l, i) => <button key={l} className={`agent-segment-pill agent-segment-pill-sm${i === 2 ? " on" : ""}`}>{l}</button>)}
          </>} />

        <Block n="I2" title="Snooze menu — the Snooze button (ink, not coral)"
          why={<>It's already an arc <code>&lt;Button&gt;</code> — but the <strong>default (ink) primary</strong>, so it renders near-black, not the brand coral.</>}
          rec={<>Add the coral token override, same as every other primary CTA on the hub.</>}
          current={<Button size="sm" style={{ width: 200 }}>Snooze all 3</Button>}
          proposed={<Button size="sm" style={{ width: 200, ...CORAL_TOKENS }}>Snooze all 3</Button>} />

        <Block n="I3" title="Save / Cancel pairs — Cancel is a bare text link"
          why={<>In the Assign flow + inline date editors, the pair is a filled <strong>Save</strong> next to a bare <code>.agent-link</code> <strong>Cancel</strong> — unbalanced, and not a button.</>}
          rec={<>Cancel becomes an arc <strong>ghost</strong> (or secondary) button so the pair reads as two peers.</>}
          current={<>
            <button className={buttonClasses({ variant: "primary", size: "sm" })} style={CORAL_TOKENS}>Save</button>
            <button className="agent-link" style={{ fontSize: 11 }}>Cancel</button>
          </>}
          proposed={<>
            <button className={buttonClasses({ variant: "primary", size: "sm" })} style={CORAL_TOKENS}>Save</button>
            <button className={buttonClasses({ variant: "ghost", size: "sm" })}>Cancel</button>
          </>} />

        <Block n="I4" title="ChaseDrawer — agent-btn neutral / primary / secondary"
          why={<>The chase drawer footer is still the old family: <code>agent-btn-neutral</code>, <code>agent-btn-primary</code> (coral gradient), <code>agent-btn-secondary</code> (+ a <code>chase-primary-green</code> WhatsApp variant).</>}
          rec={<>arc: <code>secondary</code> for Cancel, <code>primary</code>+coral for Send, <code>outline</code> where a quiet action. The green WhatsApp send keeps its green via a token override on primary.</>}
          current={<>
            <button className="agent-btn agent-btn-neutral agent-btn-sm">Cancel</button>
            <button className="agent-btn agent-btn-md agent-btn-secondary chase-secondary">Preview</button>
            <button className="agent-btn agent-btn-md agent-btn-primary">Send chase</button>
          </>}
          proposed={<>
            <button className={buttonClasses({ variant: "secondary", size: "sm" })}>Cancel</button>
            <button className={buttonClasses({ variant: "outline", size: "md" })}>Preview</button>
            <button className={buttonClasses({ variant: "primary", size: "md" })} style={CORAL_TOKENS}>Send chase</button>
          </>} />

        <Block n="I5" title="Confirm modals — agent-btn-neutral Cancel"
          why={<>ConfirmMilestoneDateModal / AddClientEmailModal / Resume / Withdraw footers use <code>agent-btn-neutral</code> (or an <code>agent-link</code>) Cancel + a primary confirm.</>}
          rec={<>arc <code>secondary</code> Cancel + <code>primary</code>+coral confirm — one modal-footer pattern everywhere.</>}
          current={<>
            <button className="agent-btn agent-btn-neutral agent-btn-md">Cancel</button>
            <button className="agent-btn agent-btn-md agent-btn-primary">Confirm</button>
          </>}
          proposed={<>
            <button className={buttonClasses({ variant: "secondary", size: "md" })}>Cancel</button>
            <button className={buttonClasses({ variant: "primary", size: "md" })} style={CORAL_TOKENS}>Confirm</button>
          </>} />

        <section style={{ borderTop: "1px solid var(--compare-line)", padding: "24px 0 0" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 650 }}>The reveal-layer inventory (so nothing's missed again)</h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: "var(--compare-body)", lineHeight: 1.7, maxWidth: 900 }}>
            <li><strong>SnoozeMenu</strong> — chips (I1) + Snooze button (I2) + a <code>rem-clock-btn</code> trigger.</li>
            <li><strong>Assign flow / inline date editors</strong> (AttentionCard) — Save/Cancel pairs (I3).</li>
            <li><strong>ChaseDrawer</strong> — footer + channel buttons (I4); the biggest single surface.</li>
            <li><strong>Modals</strong> — ConfirmMilestoneDateModal, AddClientEmailModal, ResumeFileModal, ReviseExchangeDateModal, WithdrawFileModal (I5).</li>
          </ul>
          <p style={{ margin: "14px 0 0", fontSize: 13.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 900 }}>Approve and I apply all of I1–I5 (surface by surface, verified), finish the approved A6 + D3 HeatBand, then re-audit once more with every reveal state opened — so it's genuinely complete.</p>
        </section>
      </div>
    </div>
  );
}
