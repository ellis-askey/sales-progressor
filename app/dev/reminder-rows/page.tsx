"use client";

// /dev/reminder-rows — proposal bench for levelling up the "coming up" secondary
// rows inside a Reminders file card. The file header, the primary (chaseable)
// row, and the footer are reproduced from the live card; only the secondary
// section swaps between Current and two proposed treatments. Read-only mock —
// changes nothing in the real component.

import { useState } from "react";

type Variant = "current" | "a" | "b";

const SECONDARIES = [
  { title: "Lender valuation has been booked", side: "Buyer", due: "Wed 11 Nov",
    context: "Waiting on the buyer's lender to book the mortgage valuation so the application can move forward." },
  { title: "Buyer has received the survey report", side: "Buyer", due: "Wed 11 Nov",
    context: "Waiting on the buyer to receive their survey report back from the surveyor." },
];

function CalIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function ClockIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}

function SideDot({ side }: { side: string }) {
  const buyer = side === "Buyer";
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: buyer ? "var(--rr-green)" : "var(--rr-blue)", flexShrink: 0 }} />;
}

function DuePill({ due }: { due: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--rr-muted)", background: "var(--rr-pill)", border: "0.5px solid var(--rr-border)", borderRadius: 999, padding: "2px 8px" }}>
      <span style={{ color: "var(--rr-muted)", display: "inline-flex" }}><CalIcon size={11} /></span>
      Due {due}
    </span>
  );
}

export default function ReminderRowsPage() {
  const [dark, setDark] = useState(false);
  const [variant, setVariant] = useState<Variant>("a");

  return (
    <div className={`rr-root${dark ? " rr-dark" : ""}`}>
      <style>{CSS}</style>

      <header className="rr-head">
        <div>
          <h1 className="rr-h1">Reminders — "coming up" rows</h1>
          <p className="rr-sub">Levelling up the secondary rows inside a file card. The header, primary row and footer are the live card; only the secondary section changes. Read-only.</p>
        </div>
        <div className="rr-controls">
          <div className="rr-seg">
            {(["current", "a", "b"] as Variant[]).map((v) => (
              <button key={v} className={variant === v ? "on" : ""} onClick={() => setVariant(v)}>
                {v === "current" ? "Current" : v === "a" ? "Proposed A" : "Proposed B"}
              </button>
            ))}
          </div>
          <button className="rr-theme" onClick={() => setDark((d) => !d)}>{dark ? "☾ Dark" : "☀ Light"}</button>
        </div>
      </header>

      <div className="rr-stage">
        {/* ── The file card (faithful to the live one) ── */}
        <div className="rr-card">
          {/* header */}
          <div className="rr-cardhead">
            <div className="rr-thumb" aria-hidden />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="rr-addr">2 Hedwick Avenue</span>
                <span className="rr-chev">›</span>
              </div>
              <p className="rr-loc">Bristol, BS5 8EA</p>
            </div>
            <span className="rr-collapse" aria-hidden>⌃</span>
          </div>

          {/* primary (chaseable) row — unchanged, reflects the #1 wording fix */}
          <div className="rr-primary">
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="rr-ptitle">Money on account paid to UTK</p>
              <p className="rr-pdesc">Amy West-Brownbill &amp; Finn West-Brownbill need to pay the requested money on account to UTK so searches can be ordered and the legal work can progress.</p>
              <p className="rr-pstatus">↻ Not chased yet · First nudge due</p>
            </div>
            <div className="rr-paction">
              <button className="rr-clock" aria-label="Snooze"><ClockIcon size={16} /></button>
              <span className="rr-chasebtn">Chase <span className="rr-chasecaret">⌄</span></span>
              <p className="rr-nextline">Chase due tomorrow</p>
              <p className="rr-nextdate"><CalIcon size={12} /> 10 Nov 2026</p>
            </div>
          </div>

          {/* secondary section — the thing we're levelling up */}
          <div className="rr-secwrap">
            {SECONDARIES.map((s, i) => (
              <div key={s.title} className={`rr-secrow v-${variant}`} style={{ borderTop: i > 0 || variant !== "current" ? "0.5px solid var(--rr-border)" : "0.5px solid var(--rr-border)" }}>
                {variant === "current" && (
                  <>
                    <p className="rr-sectitle">{s.title}</p>
                    <p className="rr-secmeta-plain">{s.side} · Due {s.due}</p>
                  </>
                )}

                {variant === "a" && (
                  // Lean polish: a leading "upcoming" glyph, the context line that
                  // already exists but is hidden on multi-reminder cards, and the
                  // side + due as a tidy pill. No button (nothing to chase yet).
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span className="rr-upicon"><ClockIcon size={14} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="rr-sectitle">{s.title}</p>
                      <p className="rr-seccontext">{s.context}</p>
                      <div className="rr-secmeta">
                        <span className="rr-sidechip"><SideDot side={s.side} /> {s.side}</span>
                        <DuePill due={s.due} />
                      </div>
                    </div>
                  </div>
                )}

                {variant === "b" && (
                  // More structure: an inset "up next" card-let with a Coming up
                  // chip, so each queued step reads as a real item, clearly lighter
                  // than the primary but not an afterthought.
                  <div className="rr-secb">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span className="rr-comingchip"><ClockIcon size={11} /> Coming up</span>
                      <span className="rr-secb-due"><CalIcon size={11} /> Due {s.due}</span>
                    </div>
                    <p className="rr-sectitle" style={{ fontSize: 13 }}>{s.title}</p>
                    <p className="rr-seccontext">{s.context}</p>
                    <div className="rr-secmeta" style={{ marginTop: 6 }}>
                      <span className="rr-sidechip"><SideDot side={s.side} /> {s.side}</span>
                      <span className="rr-secb-note">You'll chase this when it's due</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* file footer — unchanged */}
          <div className="rr-footer">Client auto-chase is paused for this file</div>
        </div>

        {/* notes */}
        <div className="rr-notes">
          <p><b>Current</b> — bold title + one grey line. The explanation sentence exists in code but is hidden on multi-reminder cards.</p>
          <p><b>Proposed A (lean)</b> — un-hides that sentence, adds an "upcoming" clock glyph and a tidy side + due pill. Minimal, reads as a real queued item.</p>
          <p><b>Proposed B (structured)</b> — an inset "Coming up" card-let with a chip + due date, clearly lighter than the primary but with proper weight. The "you'll chase when due" line is calm, not alarmist (the file footer already states auto-chase is paused).</p>
          <p style={{ color: "var(--rr-muted)" }}>Neither keeps a Chase button — there's no live chase job for a step that isn't due yet, which is correct.</p>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.rr-root{--bg:#f3f0ea;--card:#fffdf9;--ink:#2d1810;--muted:#8a8275;--sub:#6c6459;
  --border:rgba(45,24,16,.1);--rr-border:rgba(45,24,16,.1);--rr-muted:#8a8275;--rr-pill:rgba(45,24,16,.04);
  --coral:#ff6b4a;--coral-deep:#f04e2c;--rr-green:#15803d;--rr-blue:#2563eb;--inset:rgba(45,24,16,.025);
  min-height:100vh;background:var(--bg);color:var(--ink);padding:28px 32px 60px;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
.rr-dark{--bg:#0d1017;--card:#161b26;--ink:#eef1f6;--muted:#9aa3b2;--sub:#aeb6c2;--border:rgba(255,255,255,.1);
  --rr-border:rgba(255,255,255,.1);--rr-muted:#9aa3b2;--rr-pill:rgba(255,255,255,.05);--inset:rgba(255,255,255,.03);}
.rr-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:22px;flex-wrap:wrap;}
.rr-h1{font-size:21px;font-weight:700;margin:0 0 4px;}
.rr-sub{font-size:13px;color:var(--muted);margin:0;max-width:620px;line-height:1.5;}
.rr-controls{display:flex;gap:10px;align-items:center;}
.rr-seg{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:var(--rr-pill);border:1px solid var(--border);}
.rr-seg button{border:0;background:transparent;color:var(--muted);font:600 12.5px inherit;padding:6px 12px;border-radius:8px;cursor:pointer;}
.rr-seg button.on{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12);}
.rr-theme{padding:8px 14px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--ink);font:600 12.5px inherit;cursor:pointer;}
.rr-stage{display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap;}

/* the card */
.rr-card{width:620px;max-width:100%;background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 10px 34px rgba(0,0,0,.08);}
.rr-cardhead{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:0.5px solid var(--border);}
.rr-thumb{width:44px;height:44px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,#c9b89f,#8a7a63);}
.rr-addr{font-size:16px;font-weight:700;color:var(--coral-deep);}
.rr-chev{color:var(--coral-deep);font-size:16px;}
.rr-loc{margin:2px 0 0;font-size:12.5px;color:var(--muted);}
.rr-collapse{color:var(--muted);font-size:14px;}

/* primary row */
.rr-primary{display:flex;gap:18px;padding:16px;align-items:flex-start;border-bottom:0.5px solid var(--border);}
.rr-ptitle{margin:0 0 8px;font-size:15px;font-weight:700;color:var(--ink);}
.rr-pdesc{margin:0;font-size:12.5px;line-height:1.5;color:var(--sub);background:var(--inset);border:1px solid var(--border);border-radius:10px;padding:10px 12px;}
.rr-pstatus{margin:8px 0 0;font-size:11.5px;color:var(--muted);}
.rr-paction{flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px;min-width:150px;}
.rr-clock{width:34px;height:34px;border-radius:9px;border:1px solid var(--border);background:var(--card);color:var(--sub);display:grid;place-items:center;cursor:pointer;align-self:flex-start;position:absolute;}
.rr-paction{position:relative;padding-top:0;}
.rr-chasebtn{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:10px;background:linear-gradient(180deg,var(--coral),var(--coral-deep));color:#fff;font-size:14px;font-weight:700;box-shadow:0 2px 0 #c63e20;cursor:pointer;}
.rr-chasecaret{opacity:.85;}
.rr-nextline{margin:8px 0 0;font-size:12.5px;color:var(--sub);font-weight:600;}
.rr-nextdate{margin:1px 0 0;font-size:13.5px;font-weight:700;color:var(--ink);display:inline-flex;align-items:center;gap:5px;}

/* secondary rows */
.rr-secwrap{}
.rr-secrow{padding:12px 16px;}
.rr-sectitle{margin:0;font-size:12.5px;font-weight:700;color:var(--ink);line-height:1.35;}
.rr-secmeta-plain{margin:3px 0 0;font-size:11.5px;color:var(--muted);}
.rr-upicon{color:var(--muted);display:inline-flex;margin-top:1px;flex-shrink:0;}
.rr-seccontext{margin:3px 0 0;font-size:11.5px;line-height:1.5;color:var(--sub);}
.rr-secmeta{display:flex;align-items:center;gap:8px;margin-top:7px;flex-wrap:wrap;}
.rr-sidechip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--sub);}
.rr-secb{background:var(--inset);border:0.5px solid var(--border);border-left:2px solid var(--coral);border-radius:0 10px 10px 0;padding:10px 12px;}
.rr-comingchip{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--coral-deep);background:rgba(240,78,44,.1);border-radius:999px;padding:2px 8px;}
.rr-secb-due{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--muted);}
.rr-secb-note{font-size:10.5px;color:var(--muted);font-style:italic;}

.rr-footer{text-align:center;padding:10px 16px;border-top:0.5px solid var(--border);font-size:11px;font-weight:600;color:var(--coral-deep);}

.rr-notes{flex:1;min-width:280px;max-width:360px;font-size:12.5px;line-height:1.55;color:var(--ink);display:flex;flex-direction:column;gap:10px;}
.rr-notes p{margin:0;}
`;
