"use client";

// /dev/compare-chasing-rhythm
//
// The one subjective fork on Automated chasing: the "Choose a rhythm" cards.
// NOW fills the selected card fully coral with an ALL-CAPS eyebrow. You asked
// to adopt the canonical "radio cards" and to fix the eyebrow + tighten.
// There are two honest ways to land that — shown rendered so you can pick.

import { useState } from "react";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";

const PRESETS = [
  { key: "responsive", name: "Responsive", weeks: "11", dots: 4, desc: "Chases sooner and more often. Best for a fast-moving market." },
  { key: "steady", name: "Steady", weeks: "14", dots: 3, desc: "A balanced rhythm that suits most sales." },
  { key: "gentle", name: "Gentle", weeks: "17", dots: 2, desc: "Fewer, softer nudges. Hands back to you sooner." },
];

function MiniPulse({ dots, on }: { dots: number; on?: boolean }) {
  const n = Math.max(2, dots);
  const step = 80 / n;
  let d = "M0 17";
  for (let i = 0; i < n; i++) { const cx = 12 + i * step; d += ` L ${(cx - 5).toFixed(1)} 17 Q ${cx.toFixed(1)} 7 ${(cx + 5).toFixed(1)} 17`; }
  d += " L 104 17";
  return (
    <svg viewBox="0 0 120 24" width={120} height={24} aria-hidden style={{ display: "block", maxWidth: "100%", marginBottom: 8 }}>
      <path d={d} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: on ? "var(--agent-coral-deep)" : "var(--agent-coral-deep)" }} />
      <circle cx="109" cy="17" r="3.4" style={{ fill: "var(--agent-warning)" }} />
    </svg>
  );
}

export default function CompareChasingRhythmPage() {
  const [nowSel, setNowSel] = useState("steady");
  const [bSel, setBSel] = useState("steady");
  const [aSel, setASel] = useState("steady");

  return (
    <div className="cmp">
      <style>{CSS}</style>

      <header className="cmp-hd">
        <h1>“Choose a rhythm” cards &mdash; which direction?</h1>
        <p>All three are live. Click to select. Pick the one you want and I’ll put it in the real page (and fix the eyebrow + tighten it to match).</p>
      </header>

      {/* NOW */}
      <section className="blk">
        <div className="blk-hd"><h2>Now</h2><span>Full coral fill when selected · ALL-CAPS eyebrow</span></div>
        <div className="grid">
          {PRESETS.map((p) => {
            const on = nowSel === p.key;
            return (
              <button key={p.key} type="button" className={`pc${on ? " on" : ""}`} onClick={() => setNowSel(p.key)}>
                <div className="pc-top"><span className="pc-name">{p.name}</span><span className="pc-tick">{on && <Check />}</span></div>
                <MiniPulse dots={p.dots} on={on} />
                <div className="pc-weeks"><span className="pc-aff">Approx</span>{p.weeks}<span className="pc-aff">weeks</span></div>
                <div className="pc-eyebrow pc-eyebrow-caps">to exchange</div>
                <p className="pc-desc">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* OPTION B — recommended */}
      <section className="blk">
        <div className="blk-hd"><h2>Option B &mdash; keep the rich card, canonical ring <span className="rec">recommended</span></h2><span>Same card (sparkline + big number kept), but selected = a coral ring not a full fill; eyebrow is sentence-case; tighter padding.</span></div>
        <div className="grid">
          {PRESETS.map((p) => {
            const on = bSel === p.key;
            return (
              <button key={p.key} type="button" className={`pc pc-b${on ? " on" : ""}`} onClick={() => setBSel(p.key)}>
                <div className="pc-top"><span className="pc-name">{p.name}</span><span className="pc-tick">{on && <Check />}</span></div>
                <MiniPulse dots={p.dots} on={on} />
                <div className="pc-weeks"><span className="pc-aff">Approx</span>{p.weeks}<span className="pc-aff">weeks</span></div>
                <div className="pc-eyebrow">To exchange</div>
                <p className="pc-desc">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* OPTION A — arc RadioCards, as shipped */}
      <section className="blk">
        <div className="blk-hd"><h2>Option A &mdash; arc RadioCards <span className="rec">shipped</span></h2><span>The canonical “radio cards” (ring + dot, subtle tint when selected). The sparkline is kept (now fixed, not stretched); the estimate reads as the meta line.</span></div>
        <div
          className="arc-scope"
          style={{
            ["--control-on"]: "var(--agent-coral-deep)",
            ["--control-glyph"]: "#fff",
            ["--surface"]: "#fff",
            ["--foreground"]: "var(--agent-text-primary)",
            ["--text-secondary"]: "var(--agent-text-secondary)",
            ["--text-muted"]: "var(--agent-text-muted)",
            ["--border"]: "var(--agent-border-default)",
          } as React.CSSProperties}
        >
          <RadioCards
            layout="grid"
            minColumnWidth={210}
            value={aSel}
            onValueChange={setASel}
            options={PRESETS.map((p) => ({
              value: p.key,
              label: p.name,
              description: (<span style={{ display: "block" }}><MiniPulse dots={p.dots} />{p.desc}</span>),
              meta: `≈ ${p.weeks} weeks to exchange`,
            }))}
          />
        </div>
      </section>
    </div>
  );
}

function Check() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}><path d="M5 12l5 5L20 7" /></svg>;
}

const CSS = `
  .cmp {
    --agent-coral: #FF6B4A; --agent-coral-deep: #E2452A; --agent-coral-rgb: 255,107,74; --agent-coral-pale: rgba(255,107,74,0.38);
    --agent-text-primary: #2D1810; --agent-text-secondary: #5A3A28; --agent-text-muted: #9a8a7f; --agent-text-on-coral: #fff;
    --agent-border-default: rgba(20,16,10,0.14); --agent-border-subtle: rgba(20,16,10,0.08); --agent-surface-elevated: #fff; --agent-warning: #C97D1A;
    max-width: 960px; margin: 0 auto; padding: 40px 28px 120px; color: var(--agent-text-primary);
  }
  .cmp-hd h1 { font-size: 24px; font-weight: 800; margin: 0 0 8px; }
  .cmp-hd > p { font-size: 14px; line-height: 1.6; color: var(--agent-text-secondary); max-width: 680px; margin: 0; }

  .blk { margin-top: 34px; }
  .blk-hd { margin-bottom: 14px; }
  .blk-hd h2 { font-size: 15.5px; font-weight: 720; margin: 0 0 3px; display: flex; align-items: center; gap: 9px; }
  .blk-hd span { font-size: 12.5px; color: var(--agent-text-muted); }
  .rec { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; color: #2F9E6B; border: 1px solid rgba(47,158,107,.4); border-radius: 6px; padding: 2px 7px; }

  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }

  .pc { text-align: left; cursor: pointer; background: #fff; border: 1.5px solid var(--agent-border-default); border-radius: 16px; padding: 18px; box-shadow: 0 1px 2px rgba(60,40,22,.04); transition: transform .18s, box-shadow .18s, border-color .18s; }
  .pc:hover { transform: translateY(-3px); box-shadow: 0 10px 26px -16px rgba(60,40,22,.3); border-color: var(--agent-coral-pale); }
  .pc-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .pc-name { font-size: 16px; font-weight: 680; letter-spacing: -.01em; color: var(--agent-text-primary); }
  .pc-tick { width: 22px; height: 22px; border-radius: 999px; display: grid; place-items: center; border: 1.5px solid var(--agent-border-default); color: var(--agent-coral-deep); }
  .pc-weeks { font-size: 26px; font-weight: 740; letter-spacing: -.025em; color: var(--agent-coral-deep); display: flex; align-items: baseline; gap: 6px; }
  .pc-aff { font-size: 12.5px; font-weight: 650; color: var(--agent-text-muted); }
  .pc-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .02em; color: var(--agent-text-muted); margin-bottom: 11px; }
  .pc-eyebrow-caps { font-size: 10.5px; letter-spacing: .09em; text-transform: uppercase; }
  .pc-desc { margin: 0; font-size: 13px; line-height: 1.5; color: var(--agent-text-secondary); }

  /* NOW selected = full coral fill */
  .pc.on { border-color: transparent; background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 12px 26px -14px rgba(var(--agent-coral-rgb),.55); }
  .pc.on .pc-name, .pc.on .pc-weeks { color: #fff; }
  .pc.on .pc-aff { color: rgba(255,255,255,.82); }
  .pc.on .pc-eyebrow { color: rgba(255,255,255,.85); }
  .pc.on .pc-desc { color: rgba(255,255,255,.92); }
  .pc.on .pc-tick { background: #fff; border-color: #fff; }

  /* Option B selected = coral ring, tightened */
  .pc-b { padding: 16px; }
  .pc-b.on { border-color: var(--agent-coral-deep); border-width: 2px; padding: 15px; box-shadow: 0 0 0 4px rgba(var(--agent-coral-rgb),.12); background: #fff; }
  .pc-b.on .pc-name, .pc-b.on .pc-weeks { color: var(--agent-text-primary); }
  .pc-b.on .pc-weeks { color: var(--agent-coral-deep); }
  .pc-b.on .pc-tick { background: var(--agent-coral-deep); border-color: var(--agent-coral-deep); color: #fff; }
`;
