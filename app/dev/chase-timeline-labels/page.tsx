"use client";

// /dev/chase-timeline-labels — PREVIEW of the chase-timeline accuracy pass.
// Each row: what's actually TRUE on the file, what the timeline USED to say
// (misleading), and what it says NOW. The label logic below mirrors the shipped
// changes in components/transaction/ChaseTimeline.tsx + lib/services/chase-timeline.ts.
// Mock scenarios only — no wiring.

import { useState } from "react";
import { notFound } from "next/navigation";

type Scenario = {
  id: string;
  truth: string; // what's actually happening
  before: { headline: string; sub?: string }; // old (misleading)
  after: { headline: string; sub?: string; tone?: "ok" | "muted" }; // new (honest)
};

const SCENARIOS: Scenario[] = [
  {
    id: "handed",
    truth: "Buyer chase hit its 2-nudge limit — last nudge sent 10:00 this morning, now handed to your team.",
    before: { headline: "20 Nov", sub: "Auto-chase done · Buyer · Jane Sharp" },
    after: { headline: "With your team", sub: "Auto-chase done · Buyer · Jane Sharp", tone: "muted" },
  },
  {
    id: "sent-morning",
    truth: "Buyer chase (1st of 2) sent 10:00 this morning; next automated nudge is 20 Nov.",
    before: { headline: "16 Nov", sub: "Auto-chasing · 2 of 2 nudges · Buyer · Jane Sharp" },
    after: { headline: "20 Nov", sub: "Auto-chasing · 2 of 2 nudges · Buyer · Jane Sharp", tone: "ok" },
  },
  {
    id: "overdue",
    truth: "Chase was due 13 Nov but was blocked and missed its slot. It's 15:00 — this morning's run has passed.",
    before: { headline: "16 Nov", sub: "Auto-chasing · 1 of 2 nudges (reads as 'sending today')" },
    after: { headline: "17 Nov", sub: "Auto-chasing · 1 of 2 nudges (next working morning)" },
  },
  {
    id: "phantom",
    truth: "Searches step is chased to the buyer's SOLICITOR only (no buyer chase for it).",
    before: { headline: "16 Nov", sub: "A Buyer 'up next' card shown on the solicitor thread" },
    after: { headline: "—", sub: "No phantom buyer card — only the solicitor's chase shows", tone: "muted" },
  },
  {
    id: "enquiry",
    truth: "Enquiry chase is paused awaiting a reply — nothing is queued with a date.",
    before: { headline: "Scheduled", sub: "Next chase (implies a booked send)" },
    after: { headline: "Awaiting a reply", sub: "Next chase", tone: "muted" },
  },
  {
    id: "row",
    truth: "Thread-list row for a chase handed to the team.",
    before: { headline: "Handed to you  ·  20 Nov", sub: "chip + a future date (implies an auto-send)" },
    after: { headline: "Handed to you  ·  With your team", sub: "chip + honest status", tone: "muted" },
  },
];

export default function ChaseTimelineLabelsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const dark = theme === "dark";

  return (
    <div className={`ctl ${dark ? "t-dark" : "t-light"}`} data-theme={theme}>
      <style>{CSS}</style>
      <div className="wrap">
        <header>
          <h1>Chase timeline &mdash; accuracy pass</h1>
          <p>
            Automated chases send once each weekday morning (solicitor ~09:00, buyer ~09:30 UK). The timeline used to print a
            bare date with no sense of that window, so &ldquo;Due today&rdquo; could mean already-sent, sending-tomorrow, or overdue.
            Each row shows what&rsquo;s true, the old label, and the new one.
          </p>
          <div className="seg">
            <button className={!dark ? "on" : ""} onClick={() => setTheme("light")}>Light</button>
            <button className={dark ? "on" : ""} onClick={() => setTheme("dark")}>Dark</button>
          </div>
        </header>

        <div className="rows">
          {SCENARIOS.map((s) => (
            <div key={s.id} className="row">
              <div className="truth">{s.truth}</div>
              <div className="pair">
                <div className="cell before">
                  <div className="tag">Before</div>
                  <div className="hl">{s.before.headline}</div>
                  {s.before.sub && <div className="sub">{s.before.sub}</div>}
                </div>
                <div className="arrow" aria-hidden>&rarr;</div>
                <div className={`cell after ${s.after.tone ?? ""}`}>
                  <div className="tag">After</div>
                  <div className="hl">{s.after.headline}</div>
                  {s.after.sub && <div className="sub">{s.after.sub}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="foot">No change to when or how chases send &mdash; only to how the timeline describes them.</p>
      </div>
    </div>
  );
}

const CSS = `
.ctl { min-height: 100vh; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; transition: background 180ms ease, color 180ms ease; }
.t-light { --bg:#F3EEE6; --card:#fff; --txt:#2A2320; --txt2:#5C544C; --mut:#8A8178; --line:rgba(45,24,16,0.1); --coral:#F04E2C; --ok:#1F8A4A; --okbg:rgba(31,138,74,0.08); --badbg:rgba(45,24,16,0.04); background: var(--bg); color: var(--txt); }
.t-dark { --bg:#0e131a; --card:#1a2029; --txt:#e8edf3; --txt2:#b4bcc8; --mut:#8a93a1; --line:rgba(255,255,255,0.12); --coral:#FF6B4A; --ok:#4ade80; --okbg:rgba(74,222,128,0.12); --badbg:rgba(255,255,255,0.04); background: var(--bg); color: var(--txt); }
.wrap { max-width: 920px; margin: 0 auto; padding: 40px 20px 100px; }
header h1 { font-size: 22px; font-weight: 650; letter-spacing: -0.02em; margin: 0 0 8px; }
header p { font-size: 13.5px; line-height: 1.55; color: var(--txt2); margin: 0 0 16px; max-width: 80ch; }
.seg { display: inline-flex; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 3px; gap: 2px; margin-bottom: 22px; }
.seg button { appearance: none; border: none; background: none; font: inherit; font-size: 12.5px; font-weight: 550; color: var(--txt2); padding: 6px 13px; border-radius: 7px; cursor: pointer; }
.seg button.on { background: rgba(240,78,44,0.14); color: var(--coral); }
.rows { display: flex; flex-direction: column; gap: 14px; }
.row { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }
.truth { font-size: 12.5px; color: var(--txt2); line-height: 1.5; margin-bottom: 12px; }
.pair { display: grid; grid-template-columns: 1fr 28px 1fr; align-items: stretch; gap: 10px; }
@media (max-width: 640px) { .pair { grid-template-columns: 1fr; } .arrow { display: none; } }
.cell { border-radius: 11px; padding: 11px 13px; border: 1px solid var(--line); }
.cell.before { background: var(--badbg); }
.cell.after { background: var(--okbg); border-color: color-mix(in srgb, var(--ok) 35%, var(--line)); }
.cell.after.muted { background: var(--badbg); border-color: var(--line); }
.tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--mut); margin-bottom: 5px; }
.hl { font-size: 19px; font-weight: 740; letter-spacing: -0.01em; color: var(--txt); }
.cell.after:not(.muted) .hl { color: var(--ok); }
.sub { font-size: 11.5px; color: var(--mut); margin-top: 3px; line-height: 1.35; }
.arrow { display: grid; place-items: center; color: var(--mut); font-size: 18px; }
.foot { font-size: 12px; color: var(--mut); margin-top: 18px; text-align: center; }
`;
