"use client";

// /dev/dock-states — the quick-action dock in its two states: normal (has sales)
// and the pre-first-sale DISABLED state (both buttons greyed + "Add a sale first"
// on hover). The real dock keeps its position/glass; this mirrors the button
// treatment so the disabled look can be reviewed. Mock, presentation only.

import { useState } from "react";
import { notFound } from "next/navigation";
import { NotePencil, PaperPlaneTilt, Sun, MoonStars } from "@phosphor-icons/react";

function Dock({ disabled }: { disabled: boolean }) {
  const hint = disabled ? "Add a sale first" : undefined;
  const btn = (label: string, Icon: typeof NotePencil) => (
    <button
      type="button"
      title={hint}
      disabled={disabled}
      className="dk-btn"
      style={disabled ? { opacity: 0.4, cursor: "default" } : undefined}
    >
      <Icon size={17} weight="regular" />
      <span>{label}</span>
    </button>
  );
  return (
    <div className="dk-pill">
      {btn("New note", NotePencil)}
      <span className="dk-sep" />
      {btn("New email", PaperPlaneTilt)}
    </div>
  );
}

export default function DockStatesDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [dark, setDark] = useState(false);
  return (
    <div className="dk-page" data-theme={dark ? "dark" : "light"}>
      <div className="dk-top">
        <div>
          <h1 className="dk-title">Quick-action dock — states</h1>
          <p className="dk-lede">The dock stays on screen before the first sale (part of the chrome), but New note / New email are disabled with a hint, instead of opening a picker that can only say &ldquo;No sales match&rdquo;. Hover a disabled button to see the tooltip.</p>
        </div>
        <button type="button" className="dk-theme" onClick={() => setDark((v) => !v)} aria-label="Toggle theme">
          {dark ? <Sun size={16} weight="fill" /> : <MoonStars size={16} weight="fill" />}
        </button>
      </div>

      <div className="dk-case">
        <p className="dk-case-lab">Has a sale — normal</p>
        <div className="dk-stage"><Dock disabled={false} /></div>
      </div>

      <div className="dk-case">
        <p className="dk-case-lab">No sales yet — disabled (hover a button for the hint)</p>
        <div className="dk-stage"><Dock disabled={true} /></div>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.dk-page{ min-height:100vh; padding:40px 24px; font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;
  --bg:#eef1f5; --tx:#0f172a; --tx2:#475569; --pill:rgba(255,255,255,0.82); --pill-border:rgba(255,255,255,0.7);
  --btn-tx:#1f2430; --sep:rgba(15,23,42,0.12); --stage:#f6f7f9; --coral:#FF6B4A;
  background:var(--bg); color:var(--tx); }
.dk-page[data-theme="dark"]{ --bg:#0d1117; --tx:#e6edf3; --tx2:#9ba7b4; --pill:rgba(26,32,44,0.9); --pill-border:rgba(255,255,255,0.1);
  --btn-tx:#dbe2ea; --sep:rgba(255,255,255,0.14); --stage:#161b22; }

.dk-top{ max-width:760px; margin:0 auto 28px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.dk-title{ margin:0; font-size:21px; font-weight:760; letter-spacing:-0.02em; }
.dk-lede{ margin:6px 0 0; font-size:13px; color:var(--tx2); max-width:64ch; line-height:1.5; }
.dk-theme{ flex-shrink:0; width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border-radius:10px; border:1px solid var(--pill-border); background:var(--pill); color:var(--tx2); cursor:pointer; }

.dk-case{ max-width:760px; margin:0 auto 22px; }
.dk-case-lab{ font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.045em; color:var(--tx2); margin:0 0 10px 2px; }
.dk-stage{ background:var(--stage); border:1px solid var(--pill-border); border-radius:18px; padding:40px; display:flex; justify-content:center; }

/* frosted pill — approximation of the real .ug-dock fallback material */
.dk-pill{ display:inline-flex; align-items:center; gap:2px; padding:7px 10px; border-radius:22px;
  background:var(--pill); border:1px solid var(--pill-border);
  -webkit-backdrop-filter:blur(20px) saturate(1.6); backdrop-filter:blur(20px) saturate(1.6);
  box-shadow:0 14px 40px rgba(24,30,54,0.16); }
.dk-sep{ width:1px; height:20px; background:var(--sep); margin:0 4px; }
.dk-btn{ display:inline-flex; align-items:center; gap:8px; padding:8px 14px; border-radius:16px;
  border:none; background:none; cursor:pointer; font:inherit; font-size:13.5px; font-weight:600; color:var(--btn-tx);
  transition:background 120ms ease; }
.dk-btn:not(:disabled):hover{ background:rgba(15,23,42,0.05); }
.dk-page[data-theme="dark"] .dk-btn:not(:disabled):hover{ background:rgba(255,255,255,0.07); }
.dk-btn svg{ color:var(--coral); }
.dk-btn:disabled svg{ color:var(--btn-tx); }
`;
