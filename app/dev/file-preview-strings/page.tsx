"use client";

// /dev/file-preview-strings — the FULL enriched catalogue. Every milestone the
// Next reminder / Next step card can chase, generated straight from the real
// dictionaries so nothing is missing or mis-transcribed:
//   • WHO  ← ACTION_HOLDERS[code].holder  (lib/chase/action-holders.ts)
//   • WHAT ← renderChaseCardCopy(code, names, firm)  (lib/chase/chase-card-copy.ts)
// Date sits top-right ({date} placeholder here — urgency/date logic is orthogonal
// and shown in the state section). Example names are placeholders; every line is
// the real shipped copy. Mock, presentation only, no data.

import { useState } from "react";
import { notFound } from "next/navigation";
import { Sun, MoonStars, CalendarBlank } from "@phosphor-icons/react";
import { renderChaseCardCopy } from "@/lib/chase/chase-card-copy";
import { ACTION_HOLDERS } from "@/lib/chase/action-holders";

type Tone = "danger" | "due" | "muted" | "auto" | "ready" | "chain" | "warn";

// Placeholder principals per side (one seller, two buyers, to show both forms).
const VM = { client: "Marcus Green", firm: "Dawson Hart", single: true };
const PM = { client: "Daniel & Sarah Clarke", firm: "Hartwell & Co", single: false };
const HOLDER_NAME: Record<string, string> = {
  seller: VM.client, buyer: PM.client, seller_solicitor: VM.firm, buyer_solicitor: PM.firm, agent: "the agent",
};

// Re-point the line's opening subject to "They" so it reads under the "Chase {who}"
// headline instead of repeating the name. Falls back to the raw line.
function theyLine(line: string): string {
  const m = line.match(/\bneeds? to\b/);
  if (!m || m.index === undefined) return line;
  return "They need to " + line.slice(m.index + m[0].length).trimStart();
}

type Card = { code: string; who: string; body: string };
function build(codes: string[], side: typeof VM): Card[] {
  return codes.flatMap((code) => {
    const spec = ACTION_HOLDERS[code];
    if (!spec || spec.kind === "excluded") return []; // notification-only, not chased
    const copy = renderChaseCardCopy(code, side.client, side.firm, side.single);
    if (!copy) return [];
    const who = (spec.holder && HOLDER_NAME[spec.holder]) || side.client;
    return [{ code, who, body: theyLine(copy.line) }];
  });
}
const VM_CARDS = build(Array.from({ length: 21 }, (_, i) => `VM${i + 1}`), VM);
const PM_CARDS = build(Array.from({ length: 27 }, (_, i) => `PM${i + 1}`), PM);

// No live chase: the card falls back to a state sentence (nothing to name).
const STATES: { date: string; tone: Tone; text: string }[] = [
  { date: "—", tone: "ready", text: "Ready to exchange. Both solicitors have confirmed." },
  { date: "—", tone: "chain", text: "Your side is ready. Waiting on the chain to catch up." },
  { date: "2 Dec", tone: "muted", text: "Exchanged. Completing on 2 December." },
  { date: "—", tone: "muted", text: "Everything is progressing. Nothing needs you." },
  { date: "25 Nov", tone: "muted", text: "Snoozed until 25 November." },
  { date: "—", tone: "auto", text: "Autopilot is watching. No chase is needed yet." },
  { date: "Off", tone: "warn", text: "Auto-chase is off for this file. Chase manually." },
  { date: "—", tone: "muted", text: "The sale is complete." },
];

function ChaseCard({ c }: { c: Card }) {
  return (
    <div className="ffp-card">
      <div className="card-top">
        <span className="ffp-card-lab"><CalendarBlank size={14} weight="regular" /> Next reminder</span>
        <span className="card-date">{"{date}"}</span>
      </div>
      <span className="ffp-card-val">Chase {c.who}</span>
      <span className="ffp-card-sub">{c.body}</span>
      <span className="card-code">{c.code}</span>
    </div>
  );
}

export default function FilePreviewStringsDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [dark, setDark] = useState(false);
  const total = VM_CARDS.length + PM_CARDS.length;
  return (
    <div className="fps-page" data-theme={dark ? "dark" : "light"}>
      <div className="fps-top">
        <div>
          <h1 className="fps-title">Every reminder and step, enriched</h1>
          <p className="fps-lede">All {total} chaseable milestones, generated from the real dictionaries. Each names who to chase and the exact thing being chased. {"{date}"} is the only placeholder. The five notification-only steps (VM19 to VM21, PM26, PM27) aren&rsquo;t chased, so they surface as the state cards below.</p>
        </div>
        <button type="button" className="fps-theme" onClick={() => setDark((v) => !v)} aria-label="Toggle theme">
          {dark ? <Sun size={16} weight="fill" /> : <MoonStars size={16} weight="fill" />}
        </button>
      </div>

      <section className="fps-sec">
        <h2 className="fps-h2"><span className="fps-badge badge-amber">Seller side</span> {VM_CARDS.length} milestones (VM)</h2>
        <div className="cat-panel"><div className="cat-grid">{VM_CARDS.map((c) => <ChaseCard key={c.code} c={c} />)}</div></div>
      </section>

      <section className="fps-sec">
        <h2 className="fps-h2"><span className="fps-badge badge-blue">Buyer side</span> {PM_CARDS.length} milestones (PM)</h2>
        <div className="cat-panel"><div className="cat-grid">{PM_CARDS.map((c) => <ChaseCard key={c.code} c={c} />)}</div></div>
      </section>

      <section className="fps-sec">
        <h2 className="fps-h2"><span className="fps-badge">No live chase</span> state only</h2>
        <div className="cat-panel">
          <div className="cat-grid">
            {STATES.map((s, i) => (
              <div key={i} className="ffp-card">
                <div className="card-top">
                  <span className="ffp-card-lab"><CalendarBlank size={14} weight="regular" /> Next reminder</span>
                  <span className="card-date" style={{ color: s.tone === "warn" ? "var(--agent-warning)" : undefined }}>{s.date}</span>
                </div>
                <span className="ffp-card-val fps-statetext">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.fps-page{ min-height:100vh; padding:36px 20px 80px;
  --page:#e9edf1; --tx:#0f172a; --tx2:#475569; --tx3:#94a3b8; --coral:#FF6B4A; --blue:#2563eb; --amber:#b45309;
  --agent-text-primary:#0f172a; --agent-text-muted:#64748b; --agent-surface-nested:rgba(15,23,42,0.035); --agent-border-subtle:rgba(15,23,42,0.08);
  --agent-danger:#dc2626; --agent-warning:#c2410c;
  --panel:rgba(255,255,255,0.86); --panel-border:rgba(255,255,255,0.6);
  background:var(--page); color:var(--tx); font-family:ui-sans-serif,system-ui,-apple-system,sans-serif; }
.fps-page[data-theme="dark"]{ --page:#0d1117; --tx:#e6edf3; --tx2:#9ba7b4; --tx3:#6b7684; --amber:#fbbf24;
  --agent-text-primary:#e6edf3; --agent-text-muted:#9ba7b4; --agent-surface-nested:rgba(255,255,255,0.05); --agent-border-subtle:rgba(255,255,255,0.1);
  --agent-danger:#f87171; --agent-warning:#fb923c; --panel:rgba(20,27,42,0.92); --panel-border:rgba(255,255,255,0.08); }

.fps-top{ max-width:1040px; margin:0 auto 26px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.fps-title{ margin:0; font-size:21px; font-weight:760; letter-spacing:-0.02em; }
.fps-lede{ margin:6px 0 0; font-size:13px; color:var(--tx2); max-width:72ch; }
.fps-theme{ flex-shrink:0; width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border-radius:10px; border:1px solid var(--agent-border-subtle); background:var(--panel); color:var(--tx2); cursor:pointer; }
.fps-theme:hover{ color:var(--tx); border-color:var(--coral); }

.fps-sec{ max-width:1040px; margin:0 auto 34px; }
.fps-h2{ margin:0 0 12px; font-size:15px; font-weight:700; display:flex; align-items:center; gap:9px; color:var(--tx2); }
.fps-badge{ background:var(--coral); color:#fff; font-size:12px; font-weight:700; padding:3px 10px; border-radius:7px; }
.fps-badge.badge-blue{ background:var(--blue); }
.fps-badge.badge-amber{ background:var(--amber); }

.cat-panel{ border-radius:18px; padding:14px; border:1px solid var(--panel-border);
  background:var(--panel); -webkit-backdrop-filter:blur(20px) saturate(1.6); backdrop-filter:blur(20px) saturate(1.6);
  box-shadow:0 14px 40px rgba(24,30,54,0.12); }
.fps-page[data-theme="dark"] .cat-panel{ box-shadow:0 14px 40px rgba(0,0,0,0.4); }
.cat-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:10px; }

.ffp-card{ position:relative; display:flex; flex-direction:column; gap:4px; padding:12px 13px 20px; border-radius:13px;
  background:var(--agent-surface-nested); border:0.5px solid var(--agent-border-subtle); }
.card-top{ display:flex; align-items:baseline; justify-content:space-between; gap:8px; }
.ffp-card-lab{ display:inline-flex; align-items:center; gap:5px; font-size:11.5px; font-weight:600; color:var(--agent-text-muted); }
.card-date{ font-size:11.5px; font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; color:var(--agent-text-muted); }
.ffp-card-val{ font-size:14px; font-weight:600; color:var(--agent-text-primary); line-height:1.25; margin-top:1px; }
.ffp-card-val.fps-statetext{ font-weight:550; }
.ffp-card-sub{ font-size:12px; color:var(--agent-text-muted); line-height:1.4; }
.card-code{ position:absolute; bottom:8px; right:11px; font-size:9px; font-weight:700; letter-spacing:0.03em; color:var(--agent-text-muted); opacity:0.55; }
`;
