"use client";

// Cadence calendar — the working-day calendar view of a client-chase rhythm:
// each nudge lands on the day it actually sends (weekends hidden), with the
// final "back to you" hand-off highlighted. Illustrative ("as if this step
// became due today"); bank holidays aren't reflected. Extracted from the
// Automated-chasing editor (2026-11-24) into a self-contained, catalogued
// component. The coral / amber cells are the data (nudge day vs hand-back day),
// so they stay coloured by design (chart-like, not a tinted surface).

import { useEffect } from "react";

// ── Working-day date helpers ────────────────────────────────────────────────
const CAD_DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CAD_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function cadIsWD(d: Date) { const g = d.getDay(); return g !== 0 && g !== 6; }
function cadRollWD(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); while (!cadIsWD(x)) x.setDate(x.getDate() + 1); return x; }
function cadAddWD(from: Date, n: number) { const x = new Date(from); let a = 0; const t = Math.max(0, Math.round(n)); while (a < t) { x.setDate(x.getDate() + 1); if (cadIsWD(x)) a++; } return x; }
const cadOrdinal = (i: number) => (i === 1 ? "1st" : i === 2 ? "2nd" : i === 3 ? "3rd" : i + "th");

let injected = false;
function useCalendarCss() {
  useEffect(() => {
    if (injected || typeof document === "undefined") return;
    if (document.getElementById("cadence-cal-css")) { injected = true; return; }
    const el = document.createElement("style");
    el.id = "cadence-cal-css";
    el.textContent = CAL_CSS;
    document.head.appendChild(el);
    injected = true;
  }, []);
}

export function CadenceCalendar({ grace, repeat, esc }: { grace: number; repeat: number; esc: number }) {
  useCalendarCss();
  const anchor = cadRollWD(new Date());
  type Ev = { d: Date; kind: "start" | "chase" | "hand"; tag: string };
  const events: Ev[] = [{ d: anchor, kind: "start", tag: "Waiting" }];
  for (let i = 1; i <= esc; i++) events.push({ d: cadAddWD(anchor, grace + repeat * (i - 1)), kind: "chase", tag: cadOrdinal(i) + " nudge" });
  events.push({ d: cadAddWD(anchor, grace + repeat * esc), kind: "hand", tag: "Back to you" });
  const kk = (d: Date) => d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
  const byKey: Record<string, Ev> = {};
  events.forEach((e) => { byKey[kk(e.d)] = e; });
  const end = events[events.length - 1].d;
  const mon = new Date(anchor); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); // Monday of start week
  const weeks: Date[] = []; const cur = new Date(mon); let guard = 0;
  while (cur <= end && guard < 10) { weeks.push(new Date(cur)); cur.setDate(cur.getDate() + 7); guard++; }
  return (
    <div className="ct-cal">
      {weeks.map((wkMon, wi) => (
        <div className="ct-cal-wk" key={wi}>
          <span className="ct-cal-wklab">Wk {wi + 1}</span>
          {[0, 1, 2, 3, 4].map((i) => {
            const d = new Date(wkMon); d.setDate(wkMon.getDate() + i);
            const e = byKey[kk(d)];
            return (
              <div key={i} className={`ct-cal-cell${e ? " " + e.kind : ""}`}>
                <span className="ct-cal-dow">{CAD_DOW[d.getDay()]}</span>
                <span className="ct-cal-date">{d.getDate()} {CAD_MON[d.getMonth()]}</span>
                {e && e.kind !== "start" && <span className="ct-cal-tag">{e.tag}</span>}
                {e && e.kind === "start" && <span className="ct-cal-tag start">With client</span>}
              </div>
            );
          })}
        </div>
      ))}
      <p className="ct-cal-note">Sat &amp; Sun hidden. Chasing only runs on working days.</p>
    </div>
  );
}

const CAL_CSS = `
    .ct-cal{display:flex;flex-direction:column;gap:9px;padding:2px 0 0}
    .ct-cal-wk{display:grid;grid-template-columns:38px repeat(5,1fr);gap:6px;align-items:stretch}
    .ct-cal-wklab{font-size:10px;font-weight:700;color:var(--agent-text-muted);align-self:center;letter-spacing:.03em}
    .ct-cal-cell{position:relative;background:rgba(45,24,16,.025);border:1px solid var(--agent-border-subtle);border-radius:9px;min-height:56px;padding:6px 7px;display:flex;flex-direction:column;gap:2px}
    .ct-cal-dow{font-size:9.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--agent-text-muted)}
    .ct-cal-date{font-size:12px;font-weight:700;color:var(--agent-text-secondary);font-variant-numeric:tabular-nums}
    .ct-cal-tag{margin-top:auto;font-size:10px;font-weight:700;line-height:1.2}
    .ct-cal-cell.chase{background:var(--agent-coral-bg-tint);box-shadow:inset 0 0 0 1px var(--agent-coral-pale);border-color:transparent}
    .ct-cal-cell.chase .ct-cal-tag{color:var(--agent-coral-deep)}
    .ct-cal-cell.hand{background:rgba(201,125,26,.12);box-shadow:inset 0 0 0 1px rgba(201,125,26,.35);border-color:transparent}
    .ct-cal-cell.hand .ct-cal-tag{color:var(--agent-warning,#C97D1A)}
    .ct-cal-cell.start{box-shadow:inset 0 0 0 1.5px var(--agent-border-default)}
    .ct-cal-tag.start{color:var(--agent-text-muted)}
    .ct-cal-note{margin:4px 0 0;font-size:11px;color:var(--agent-text-muted)}
`;

export default CadenceCalendar;
