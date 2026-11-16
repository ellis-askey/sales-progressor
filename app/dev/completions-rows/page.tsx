"use client";

// /dev/completions-rows — PROTOTYPE for the Completions list row reflow. Drag the
// slider to shrink the container; at <=760px the header drops and each figure
// (Price / Exchanged / Completed / Fee) shows its own inline label. Mirrors the
// real CompletionsWorkspace CSS, but the <=760 rules are CONTAINER queries so the
// slider stands in for a narrowing viewport. Mock data, no wiring.

import { useState } from "react";
import { notFound } from "next/navigation";
import { Sun, MoonStars } from "@phosphor-icons/react";

type RowData = {
  addr: string; town: string; price: string; exchanged: string; completed: string;
  people: string[]; fee: string | null; // null = "Set fee"
};
const ROWS: RowData[] = [
  { addr: "21 Mandelyns", town: "Northchurch, HP4 3XH", price: "£960,000", exchanged: "16 Oct 2026", completed: "11 Nov 2026", people: ["TK", "EA"], fee: "£9,600 + VAT" },
  { addr: "49 Prospect Road", town: "Waltham Cross, EN8 9AR", price: "£499,950", exchanged: "2 Nov 2026", completed: "2 Nov 2026", people: ["EG"], fee: null },
  { addr: "55 Woodlands Avenue", town: "Berkhamsted, HP4 2JQ", price: "£387,500", exchanged: "30 Oct 2026", completed: "30 Oct 2026", people: ["RL"], fee: null },
  { addr: "29 Berwick Way", town: "Sevenoaks, TN14 5EY", price: "£235,000", exchanged: "21 Oct 2026", completed: "30 Oct 2026", people: ["RL", "RP"], fee: "£3,050 incl VAT" },
  { addr: "36 Nathaniel Walk", town: "Tring, HP23 5DG", price: "£775,000", exchanged: "20 Oct 2026", completed: "23 Oct 2026", people: ["TK"], fee: null },
];

function Row({ r }: { r: RowData }) {
  return (
    <div className="cw-row">
      <span className="cw-thumb"><span className="cw-mock-thumb" /></span>
      <span className="cw-id">
        <span className="cw-id-main">
          <span className="cw-addr">{r.addr}</span>
          <span className="cw-town">{r.town}</span>
        </span>
        <span className="cw-mock-stack">
          {r.people.map((p, i) => <span key={i} className="cw-mock-av" style={{ marginLeft: i ? -8 : 0 }}>{p}</span>)}
        </span>
      </span>
      <span className="cw-price"><span className="cw-cell-lab">Price</span>{r.price}</span>
      <span className="cw-cell"><span className="cw-cell-lab">Exchanged</span><span className="cw-cell-val">{r.exchanged}</span></span>
      <span className="cw-cell"><span className="cw-cell-lab">Completed</span><span className="cw-cell-val">{r.completed}</span></span>
      <span className="cw-trail">
        {r.fee
          ? <span className="cw-fee"><span className="cw-cell-lab">Fee</span>{r.fee}</span>
          : <button type="button" className="cw-setfee">Set fee</button>}
      </span>
    </div>
  );
}

export default function CompletionsRowsDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [width, setWidth] = useState(1024);
  const [dark, setDark] = useState(false);
  const narrow = width <= 760;
  return (
    <div className="cwd-page" data-theme={dark ? "dark" : "light"}>
      <div className="cwd-top">
        <div>
          <h1 className="cwd-title">Completions row — narrow reflow</h1>
          <p className="cwd-lede">Drag to shrink the list. At <b>≤760px</b> the header drops and every figure labels itself inline.</p>
        </div>
        <button type="button" className="cwd-theme" onClick={() => setDark((v) => !v)} aria-label="Toggle theme">
          {dark ? <Sun size={16} weight="fill" /> : <MoonStars size={16} weight="fill" />}
        </button>
      </div>

      <div className="cwd-slider">
        <input type="range" min={360} max={1100} step={10} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
        <span className="cwd-w" style={{ color: narrow ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)" }}>{width}px{narrow ? " · mobile" : ""}</span>
      </div>

      <div className="cwd-stage">
        <div className="cwd-container" style={{ width }}>
          <div className="cw-head">
            <span className="cw-head-cell cw-head-prop">Property</span>
            <span className="cw-head-cell">Price</span>
            <span className="cw-head-cell">Exchanged</span>
            <span className="cw-head-cell">Completed</span>
            <span className="cw-head-cell cw-head-status">Fee</span>
          </div>
          <div className="cw-list">{ROWS.map((r, i) => <Row key={i} r={r} />)}</div>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.cwd-page{ min-height:100vh; background:var(--agent-bg,#f6f7f9); color:var(--agent-text-primary); padding:36px 20px; }
.cwd-page[data-theme="dark"]{ --agent-bg:#0d1117; }
.cwd-top{ max-width:1140px; margin:0 auto 18px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.cwd-title{ margin:0; font-size:20px; font-weight:750; letter-spacing:-0.02em; }
.cwd-lede{ margin:6px 0 0; font-size:13px; color:var(--agent-text-secondary); }
.cwd-theme{ flex-shrink:0; width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border-radius:10px;
  border:1px solid var(--agent-border-default,rgba(15,23,42,0.1)); background:var(--agent-surface-elevated,#fff); color:var(--agent-text-secondary); cursor:pointer; }
.cwd-slider{ max-width:1140px; margin:0 auto 16px; display:flex; align-items:center; gap:12px; }
.cwd-slider input{ flex:1; accent-color:var(--agent-coral-deep,#FF6B4A); }
.cwd-w{ font-size:12.5px; font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; min-width:92px; text-align:right; }
.cwd-stage{ max-width:1140px; margin:0 auto; display:flex; justify-content:center; }
.cwd-container{ container-type:inline-size; border-radius:16px; overflow:hidden; border:1px solid var(--agent-border-subtle,rgba(15,23,42,0.08)); background:var(--agent-surface-elevated,#fff); }

/* ── copied from CompletionsWorkspace (desktop) ── */
.cw-head{ display:grid; grid-template-columns:44px minmax(0,1.7fr) minmax(74px,0.7fr) minmax(96px,0.9fr) minmax(96px,0.9fr) minmax(104px,auto);
  gap:14px; align-items:center; padding:10px 16px; background:rgba(15,23,42,0.04); border-bottom:0.5px solid var(--agent-border-subtle,rgba(15,23,42,0.08)); }
.cw-head-cell{ display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:var(--agent-text-muted); }
.cw-head-prop{ grid-column:1 / 3; }
.cw-head-status{ justify-self:end; }
.cw-list{ display:flex; flex-direction:column; }
.cw-row{ display:grid; grid-template-columns:44px minmax(0,1.7fr) minmax(74px,0.7fr) minmax(96px,0.9fr) minmax(96px,0.9fr) minmax(104px,auto);
  align-items:center; gap:14px; padding:11px 16px; border-bottom:0.5px solid var(--agent-border-subtle,rgba(15,23,42,0.08)); }
.cw-row:last-child{ border-bottom:none; }
.cw-thumb{ display:flex; }
.cw-mock-thumb{ width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,#e7ecf3,#d4dbe6); display:block; }
.cw-id{ display:flex; flex-direction:row; align-items:center; gap:8px; min-width:0; }
.cw-id-main{ display:flex; flex-direction:column; min-width:0; line-height:1.25; flex:1 1 auto; }
.cw-addr{ font-size:14px; font-weight:600; color:var(--agent-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cw-town{ font-size:11.5px; color:var(--agent-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cw-mock-stack{ display:inline-flex; flex-shrink:0; }
.cw-mock-av{ width:24px; height:24px; border-radius:50%; background:linear-gradient(135deg,#c7d2e4,#9fb0cc); color:#fff; font-size:9px; font-weight:700;
  display:inline-flex; align-items:center; justify-content:center; box-shadow:0 0 0 1.5px var(--agent-surface-elevated,#fff); }
.cw-price{ font-size:13.5px; font-weight:700; color:var(--agent-text-primary); font-variant-numeric:tabular-nums; white-space:nowrap; }
.cw-cell{ display:flex; flex-direction:column; min-width:0; line-height:1.2; }
.cw-cell-lab{ display:none; }
.cw-cell-val{ font-size:12.5px; font-weight:500; color:var(--agent-text-secondary); white-space:nowrap; }
.cw-trail{ justify-self:end; display:flex; align-items:center; justify-content:flex-end; min-width:0; }
.cw-fee{ font-size:13.5px; font-weight:700; color:var(--agent-coral-deep,#FF6B4A); font-variant-numeric:tabular-nums; white-space:nowrap; }
.cw-setfee{ font-size:12.5px; font-weight:600; color:var(--agent-coral-deep,#FF6B4A); background:none; border:none; cursor:pointer; font-family:inherit; padding:0; }

/* ── narrow reflow: CONTAINER query here, @media in the real component.
   Line 1 = property + people (top-right). Line 2 = Fee + Price. Line 3 =
   Exchanged + Completed. ── */
@container (max-width:760px){
  .cw-head{ display:none; }
  .cw-row{ display:flex; flex-wrap:wrap; align-items:flex-start; column-gap:16px; row-gap:9px; padding:14px 16px; }
  .cw-thumb{ order:0; }
  .cw-id{ order:1; flex:1 1 60%; align-items:flex-start; }
  .cw-trail{ order:2; flex:1 1 40%; justify-self:auto; justify-content:flex-start; }
  .cw-price{ order:3; flex:1 1 40%; display:inline-flex; align-items:baseline; gap:5px; font-size:12.5px; }
  .cw-cell{ order:4; flex:1 1 40%; flex-direction:row; align-items:baseline; gap:5px; }
  .cw-fee{ display:inline-flex; align-items:baseline; gap:5px; font-size:12.5px; }
  .cw-cell-lab{ display:inline; flex-shrink:0; font-size:10px; text-transform:uppercase; letter-spacing:0.04em; color:var(--agent-text-muted); font-weight:700; }
  .cw-cell-val{ font-size:12px; }
}
`;
