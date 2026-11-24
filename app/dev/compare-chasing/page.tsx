"use client";

// /dev/compare-chasing
//
// Before/after review for the canonical pass on Account > Automated chasing.
// LEFT ("Now") reproduces the live styles byte-for-byte (including their real
// :hover / :active); RIGHT ("Proposed") renders the canonical primitives /
// treatments with their real interactions. The "Staying as-is" items are
// rendered (not just described) so they can be seen in place. Review surface
// only; nothing ships here.

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/arc/button/button";

const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

export default function CompareChasingPage() {
  return (
    <div className="cmp">
      <style>{CMP_CSS}</style>
      <style>{NOW_CSS}</style>

      <header className="cmp-hd">
        <h1>Automated chasing &mdash; canonical pass</h1>
        <p>
          Account &rsaquo; Automated chasing. This page is already warm-toned, so the pass is small: tidy a couple of
          filled pills, make the two Save buttons match, de-tint one info strip, and fix a little wording. Every control
          below is live &mdash; hover the buttons to compare them.
        </p>
      </header>

      {/* 1 */}
      <Card
        n={1}
        title="The little status pills become outlined tags, not filled-in blobs"
        blurb="Two coral-filled pills become the app’s standard outlined tag (coral text, thin border, no fill), the same tag we switched to on Team and Email templates."
      >
        <Col label="Now">
          <span className="ct-badge">3 changed</span>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <span className="pillnow pillnow-custom">Your customised copy</span>
            <span className="pillnow pillnow-default">Our default copy</span>
          </div>
        </Col>
        <Col label="Proposed">
          <Badge tone="accent" caps={false}>3 changed</Badge>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <Badge tone="accent" caps={false}>Your customised copy</Badge>
            <Badge tone="neutral" caps={false}>Our default copy</Badge>
          </div>
        </Col>
      </Card>

      {/* 2 */}
      <Card
        n={2}
        title="Both Save buttons become the real canonical button (arc Button)"
        blurb="You were right: the approved canonical is the arc Button (flat coral). Today the page has TWO non-canonical buttons: the top “What we chase” card uses the older glossy coral, and the timing editor uses a flat hard-coded coral. Both become the one arc Button. Hover each column: the old ones darken / sit flat; the arc Button brightens a touch and lifts, the same as on Emails and Email templates."
      >
        <Col label="Now">
          <span className="cmp-mini">Timing editor save bar</span>
          <div className="cmp-btnrow">
            <button type="button" className="ct-btn ghost">Reset</button>
            <button type="button" className="ct-btn primary">Save changes</button>
          </div>
          <span className="cmp-mini" style={{ marginTop: 18 }}>Top “What we chase” card</span>
          <button type="button" className="acct-primary acct-sm">Save changes</button>
        </Col>
        <Col label="Proposed">
          <span className="cmp-mini">Timing editor save bar</span>
          <div className="cmp-btnrow">
            <Button variant="secondary" size="sm">Reset</Button>
            <Button variant="primary" size="sm" style={coralVars}>Save changes</Button>
          </div>
          <span className="cmp-mini" style={{ marginTop: 18 }}>Top “What we chase” card</span>
          <Button variant="primary" size="sm" style={coralVars}>Save changes</Button>
        </Col>
      </Card>

      {/* 3 */}
      <Card
        n={3}
        title="The summary strip loses its faint coral tint"
        blurb="The “On the Steady rhythm, a typical sale reaches exchange in…” strip has a faint coral wash behind it. Per the no-tinted-fills rule, it becomes a clean surface with the same thin border and the same little coral icon, so the accent is carried by the icon, not a background wash."
      >
        <Col label="Now">
          <div className="ct-summary">
            <span className="ct-summary-ic" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>
            </span>
            <p>On the <b>Steady</b> rhythm, a typical sale reaches exchange in <b>approx 14 weeks</b>. Every waiting step gets up to <b>2 chases</b> before it comes to you.</p>
          </div>
        </Col>
        <Col label="Proposed">
          <div className="ct-summary ct-summary-flat">
            <span className="ct-summary-ic" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>
            </span>
            <p>On the <b>Steady</b> rhythm, a typical sale reaches exchange in <b>approx 14 weeks</b>. Every waiting step gets up to <b>2 chases</b> before it comes to you.</p>
          </div>
        </Col>
      </Card>

      {/* 4 */}
      <Card
        n={4}
        title="Small wording fixes so it sounds like us"
        blurb="House-style corrections to match the voice rules used everywhere else."
      >
        <Col label="Now">
          <p className="cmp-copy"><span className="cmp-bad">Automatically</span> remind buyers and sellers about outstanding steps&hellip; <span className="cmp-sub">(Client chases tip)</span></p>
          <p className="cmp-copy"><span className="cmp-bad">Automatically</span> notify connected agents when important dates&hellip; <span className="cmp-sub">(Chain updates tip)</span></p>
          <p className="cmp-copy">Sat &amp; Sun hidden <span className="cmp-bad">&mdash;</span> chasing only runs on working days. <span className="cmp-sub">(calendar note)</span></p>
        </Col>
        <Col label="Proposed">
          <p className="cmp-copy"><span className="cmp-good">We&rsquo;ll</span> remind buyers and sellers about outstanding steps&hellip;</p>
          <p className="cmp-copy"><span className="cmp-good">We&rsquo;ll</span> notify connected agents when important dates&hellip;</p>
          <p className="cmp-copy">Sat &amp; Sun hidden<span className="cmp-good">.</span> Chasing only runs on working days.</p>
        </Col>
      </Card>

      {/* 5 - invisible tidy */}
      <Card
        n={5}
        title="Behind-the-scenes tidy (nothing changes on screen)"
        blurb="Housekeeping with no visible effect: three leftover cool-grey colours in the toggle card swap to the warm theme tokens (they already fall back to the same warm colour); dead left-over switch styling from an earlier change is deleted; and one hard-coded error-text red becomes the standard danger token."
      >
        <Col label="Now">
          <p className="cmp-copy cmp-sub">3 cool greys · dead .acg-switch / .ct-switch CSS · error red #b42318</p>
        </Col>
        <Col label="Proposed">
          <p className="cmp-copy cmp-sub">warm tokens · removed · var(--agent-danger)</p>
        </Col>
      </Card>

      {/* Grandfather - rendered */}
      <section className="cmp-gf">
        <h2>Staying exactly as-is</h2>
        <p className="cmp-gf-intro">These keep their current look and behaviour. Shown here, live, so you can see what stays:</p>

        <div className="gf-grid">
          <GF label="Number steppers - needs a NEW canonical" why="There’s no canonical +/− stepper yet (the arc “Stepper” is a progress indicator, a different thing). I can extract this one into a shared primitive, your call. Preserves clamp + select-on-focus.">
            <span className="ct-stp">
              <button type="button">&minus;</button>
              <input defaultValue="3" aria-label="example" />
              <button type="button">+</button>
            </span>
          </GF>

          <GF label="Seller / Buyer picker - canonical exists, look changes" why="It carries a live count per side. The canonical GlassTabs DOES support counts, but it’s a glass-chip look (not this coral pill). SegmentedSwitch matches the pill but can’t show counts. A real choice.">
            <div className="ct-seg">
              <span className="ct-seg-pill" style={{ left: 3, width: 96 }} aria-hidden />
              <button type="button" className="on">Seller <span className="ct-seg-n">14</span></button>
              <button type="button">Buyer <span className="ct-seg-n">13</span></button>
            </div>
          </GF>

          <GF label="“Open all / Collapse all” link - not a formal primitive" why="This is a plain coral text link, not a catalogued component. Low value to formalise; I’d leave it unless you want a canonical text-link made.">
            <button type="button" className="ct-link">Open all</button>
          </GF>

          <GF label="Calendar preview - a data-viz, no canonical" why="The coral and amber cells ARE the information (nudge day vs hand-back day), like a chart. No canonical equivalent; it stays unless you want a viz primitive built.">
            <div className="ct-cal">
              <div className="ct-cal-wk">
                <span className="ct-cal-wklab">Wk 2</span>
                <div className="ct-cal-cell"><span className="ct-cal-dow">Mon</span><span className="ct-cal-date">8</span></div>
                <div className="ct-cal-cell chase"><span className="ct-cal-dow">Tue</span><span className="ct-cal-date">9</span><span className="ct-cal-tag">Nudge</span></div>
                <div className="ct-cal-cell"><span className="ct-cal-dow">Wed</span><span className="ct-cal-date">10</span></div>
                <div className="ct-cal-cell hand"><span className="ct-cal-dow">Thu</span><span className="ct-cal-date">11</span><span className="ct-cal-tag">To you</span></div>
                <div className="ct-cal-cell"><span className="ct-cal-dow">Fri</span><span className="ct-cal-date">12</span></div>
              </div>
            </div>
          </GF>
        </div>

        <div className="gf-wide">
          <div className="gf-render">
            <div className="ct-profiles">
              {[
                { name: "Responsive", weeks: "11", desc: "Chases sooner, more often. Best for a fast market.", on: false },
                { name: "Steady", weeks: "14", desc: "A balanced rhythm for most sales.", on: true },
                { name: "Gentle", weeks: "17", desc: "Fewer, softer nudges. Hands back to you sooner.", on: false },
              ].map((p) => (
                <button key={p.name} type="button" className={`ct-pcard${p.on ? " on" : ""}`}>
                  <div className="ct-pcard-top">
                    <span className="ct-pcard-name">{p.name}</span>
                    <span className="ct-tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg></span>
                  </div>
                  <div className="ct-pcard-label">to exchange</div>
                  <div className="ct-pcard-weeks">{p.weeks}<span className="ct-wk-affix">weeks</span></div>
                  <p className="ct-pcard-desc">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="gf-meta">
            <strong>The selected rhythm card (Responsive / Steady / Gentle) - arc RadioCards, but lab-only</strong>
            <span>Yes, this is a “radio cards” pattern, and the arc kit HAS a canonical RadioCards. But two catches: it’s still lab-only (not yet promoted to production like arc Button was), and its selected state is a thin selection ring + dot, NOT this full coral fill. So adopting it is a promote-from-lab decision plus a real look change you’d need to sign off. ⚑ Your call.</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function Card({ n, title, blurb, flag, children }: { n: number; title: string; blurb: string; flag?: string; children: React.ReactNode }) {
  return (
    <section className="cmp-card">
      <div className="cmp-card-hd">
        <span className="cmp-n">{n}</span>
        <div>
          <h3>{title}</h3>
          <p>{blurb}</p>
          {flag && <p className="cmp-flag">⚑ {flag}</p>}
        </div>
      </div>
      <div className="cmp-cols">{children}</div>
    </section>
  );
}

function Col({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cmp-col">
      <span className="cmp-col-lbl">{label}</span>
      <div className="cmp-col-body">{children}</div>
    </div>
  );
}

function GF({ label, why, children }: { label: string; why: string; children: React.ReactNode }) {
  return (
    <div className="gf-item">
      <div className="gf-render">{children}</div>
      <div className="gf-meta"><strong>{label}</strong><span>{why}</span></div>
    </div>
  );
}

const CMP_CSS = `
  .cmp {
    --agent-coral: #FF6B4A; --agent-coral-deep: #E2452A; --agent-coral-darker: #C0431F; --agent-coral-rgb: 255,107,74;
    --agent-coral-bg-tint: rgba(255,107,74,0.07); --agent-coral-pale: rgba(255,107,74,0.38);
    --agent-text-primary: #2D1810; --agent-text-secondary: #5A3A28; --agent-text-muted: #9a8a7f; --agent-text-tertiary: #7A4A2E;
    --agent-border-default: rgba(20,16,10,0.14); --agent-border-subtle: rgba(20,16,10,0.08);
    --agent-surface-elevated: #ffffff; --agent-btn-text: #fff; --agent-warning: #C97D1A;
    max-width: 1000px; margin: 0 auto; padding: 40px 28px 120px; color: var(--agent-text-primary);
  }
  .cmp-hd h1 { font-size: 26px; font-weight: 800; margin: 0 0 8px; }
  .cmp-hd > p { font-size: 14px; line-height: 1.6; color: var(--agent-text-secondary); max-width: 720px; margin: 0; }

  .cmp-card { margin-top: 30px; border: 1px solid var(--agent-border-default); border-radius: 16px; overflow: hidden; background: #fff; }
  .cmp-card-hd { display: flex; gap: 13px; padding: 18px 20px; border-bottom: 1px solid var(--agent-border-subtle); }
  .cmp-n { flex: 0 0 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: var(--agent-coral-deep); color: #fff; font-size: 13px; font-weight: 800; }
  .cmp-card-hd h3 { font-size: 15.5px; font-weight: 720; margin: 1px 0 5px; }
  .cmp-card-hd > div > p { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); margin: 0; max-width: 820px; }
  .cmp-flag { margin-top: 8px !important; font-size: 12.5px !important; color: var(--agent-text-tertiary) !important; background: rgba(201,125,26,0.08); border-radius: 8px; padding: 8px 11px; }

  .cmp-cols { display: grid; grid-template-columns: 1fr 1fr; }
  .cmp-col { padding: 22px; min-width: 0; }
  .cmp-col:first-child { border-right: 1px solid var(--agent-border-subtle); background: rgba(45,24,16,0.02); }
  .cmp-col-lbl { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--agent-text-muted); margin-bottom: 14px; }
  .cmp-col-body { display: flex; flex-direction: column; align-items: flex-start; }

  .cmp-mini { display: block; font-size: 11px; font-weight: 600; color: var(--agent-text-muted); margin-bottom: 8px; }
  .cmp-btnrow { display: flex; gap: 10px; align-items: center; }
  .cmp-copy { font-size: 13.5px; line-height: 1.5; margin: 0 0 10px; color: var(--agent-text-secondary); }
  .cmp-sub { font-size: 12px; color: var(--agent-text-muted); }
  .cmp-bad { text-decoration: line-through; color: #b42318; font-weight: 600; }
  .cmp-good { font-weight: 700; color: var(--agent-text-primary); }

  /* Proposed buttons = the canonical account buttons (real treatment + hover/active). */
  .acct-primary { font-size: 14.5px; font-weight: 650; color: #fff; border: none; border-radius: 8px; padding: 11px 22px; cursor: pointer;
    background: linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep)); box-shadow: 0 4px 16px rgba(var(--agent-coral-rgb), 0.26);
    transition: filter 140ms ease, transform 90ms ease, box-shadow 140ms ease; }
  .acct-primary:hover { filter: saturate(1.04) brightness(1.02); box-shadow: 0 7px 22px rgba(var(--agent-coral-rgb), 0.32); transform: translateY(-1px); }
  .acct-primary:active { transform: translateY(1px); box-shadow: inset 0 2px 5px rgba(0,0,0,0.2); }
  .acct-primary.acct-sm { font-size: 13px; font-weight: 500; padding: 9px 18px; }
  .acct-secondary { font-size: 14.5px; font-weight: 650; color: var(--agent-text-secondary); background: #fff; border: 1.5px solid var(--agent-border-default); border-radius: 8px; padding: 11px 22px; cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease, transform 90ms ease; }
  .acct-secondary:hover { background: #f6f6f7; border-color: rgba(0,0,0,0.24); }
  .acct-secondary:active { transform: scale(0.97); }

  .cmp-gf { margin-top: 40px; border-top: 2px solid var(--agent-border-subtle); padding-top: 26px; }
  .cmp-gf h2 { font-size: 17px; font-weight: 760; margin: 0 0 4px; }
  .cmp-gf-intro { font-size: 13px; color: var(--agent-text-secondary); margin: 0 0 20px; }
  .gf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .gf-item, .gf-wide { border: 1px solid var(--agent-border-default); border-radius: 14px; overflow: hidden; background: #fff; }
  .gf-wide { margin-top: 16px; }
  .gf-render { padding: 22px; display: flex; justify-content: center; background: rgba(45,24,16,0.015); border-bottom: 1px solid var(--agent-border-subtle); }
  .gf-meta { padding: 13px 16px; display: flex; flex-direction: column; gap: 3px; }
  .gf-meta strong { font-size: 13px; font-weight: 700; color: var(--agent-text-primary); }
  .gf-meta span { font-size: 12px; line-height: 1.5; color: var(--agent-text-muted); }

  @media (max-width: 760px) {
    .cmp-cols, .gf-grid { grid-template-columns: 1fr; }
    .cmp-col:first-child { border-right: 0; border-bottom: 1px solid var(--agent-border-subtle); }
  }
`;

// Byte-for-byte copies of the live styles (incl. real :hover / :active) used by
// the "Now" column and the rendered grandfather controls.
const NOW_CSS = `
  .ct-badge{font-size:11px;font-weight:700;color:#fff;background:linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 2px 6px rgba(var(--agent-coral-rgb),.28);padding:3px 10px;border-radius:999px;display:inline-block}
  .pillnow{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;display:inline-block}
  .pillnow-custom{color:var(--agent-coral-deep);background:rgba(255,107,74,0.12)}
  .pillnow-default{color:var(--agent-text-muted);background:rgba(45,24,16,0.04)}

  .ct-btn{appearance:none;font:inherit;font-weight:650;font-size:14.5px;border-radius:12px;cursor:pointer;padding:11px 22px;transition:.15s;border:1.5px solid transparent}
  .ct-btn.ghost{background:none;border-color:var(--agent-border-default);color:var(--agent-text-secondary)}
  .ct-btn.ghost:hover{color:var(--agent-text-primary);border-color:var(--agent-text-muted)}
  .ct-btn.primary{background:var(--agent-coral-deep);color:#fff;box-shadow:0 7px 18px -7px rgba(255,107,74,.6)}
  .ct-btn.primary:hover{background:var(--agent-coral-darker);transform:translateY(-1px)}

  .ct-summary{display:flex;gap:15px;align-items:flex-start;padding:17px 19px;border-radius:16px;background:linear-gradient(180deg,var(--agent-coral-bg-tint),rgba(255,255,255,.5));border:1px solid var(--agent-border-default);max-width:460px}
  .ct-summary-flat{background:var(--agent-surface-elevated)}
  .ct-summary p{margin:0;font-size:13.5px;line-height:1.5;color:var(--agent-text-secondary)}
  .ct-summary p b{color:var(--agent-text-primary);font-weight:680}
  .ct-summary-ic{flex-shrink:0;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:#fff;border:1px solid var(--agent-coral);color:var(--agent-coral-deep)}
  .ct-summary-ic svg{width:17px;height:17px}

  .ct-stp{display:inline-flex;align-items:center;background:#fff;border:1.5px solid var(--agent-border-default);border-radius:11px;overflow:hidden;box-shadow:0 1px 2px rgba(60,40,22,.04);transition:.15s;vertical-align:middle}
  .ct-stp:focus-within{border-color:var(--agent-coral-deep)}
  .ct-stp button{appearance:none;border:none;cursor:pointer;width:32px;height:36px;display:grid;place-items:center;font-size:18px;font-weight:600;line-height:1;transition:background .14s,color .14s,transform .1s;color:var(--agent-text-muted);background:transparent}
  .ct-stp button:hover{color:#fff;background:linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep));box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
  .ct-stp button:active{transform:scale(.9);color:#fff;background:linear-gradient(180deg,var(--agent-coral-deep),var(--agent-coral-darker));box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
  .ct-stp input{width:38px;height:36px;border:none;background:none;text-align:center;font:inherit;font-size:15.5px;font-weight:700;color:var(--agent-text-primary);padding:0}
  .ct-stp input:focus{outline:none}

  .ct-seg{position:relative;display:inline-flex;background:#fff;border:1px solid var(--agent-border-default);border-radius:999px;padding:3px;box-shadow:0 1px 2px rgba(60,40,22,.04)}
  .ct-seg-pill{position:absolute;top:3px;bottom:3px;z-index:0;border-radius:999px;background:linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 2px 6px rgba(var(--agent-coral-rgb),.28)}
  .ct-seg button{position:relative;z-index:1;appearance:none;border:none;background:none;font:inherit;font-size:13.5px;font-weight:600;color:var(--agent-text-secondary);padding:7px 16px;border-radius:999px;cursor:pointer;transition:color .18s}
  .ct-seg button.on{color:#fff}
  .ct-seg button:not(.on):hover{color:var(--agent-text-primary)}
  .ct-seg-n{font-size:11px;opacity:.6;font-weight:650}
  .ct-seg button.on .ct-seg-n{opacity:.82}

  .ct-link{appearance:none;background:none;border:none;font:inherit;font-size:13.5px;font-weight:650;color:var(--agent-coral-deep);cursor:pointer;padding:5px 3px;border-radius:7px}
  .ct-link:hover{text-decoration:underline;text-underline-offset:3px}

  .ct-profiles{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;width:100%}
  .ct-pcard{text-align:left;cursor:pointer;background:#fff;border:1.5px solid var(--agent-border-default);border-radius:16px;padding:18px;box-shadow:0 1px 2px rgba(60,40,22,.04);transition:transform .18s,box-shadow .18s,border-color .18s}
  .ct-pcard:hover{transform:translateY(-3px);box-shadow:0 10px 26px -16px rgba(60,40,22,.3);border-color:var(--agent-coral-pale)}
  .ct-pcard.on{border-color:transparent;background:linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 12px 26px -14px rgba(var(--agent-coral-rgb),.55)}
  .ct-pcard.on:hover{border-color:transparent;transform:translateY(-2px)}
  .ct-pcard-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .ct-pcard-name{font-size:16px;font-weight:680;letter-spacing:-.01em;color:var(--agent-text-primary)}
  .ct-pcard.on .ct-pcard-name{color:#fff}
  .ct-tick{width:22px;height:22px;border-radius:999px;display:grid;place-items:center;border:1.5px solid var(--agent-border-default);transition:.15s}
  .ct-pcard.on .ct-tick{background:#fff;border-color:#fff}
  .ct-tick svg{width:12px;height:12px;color:var(--agent-coral-deep);opacity:0}
  .ct-pcard.on .ct-tick svg{opacity:1}
  .ct-pcard-label{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--agent-text-muted);margin-bottom:11px}
  .ct-pcard.on .ct-pcard-label{color:rgba(255,255,255,.85)}
  .ct-pcard-weeks{font-size:26px;font-weight:740;letter-spacing:-.025em;color:var(--agent-coral-deep);display:flex;align-items:baseline;gap:6px}
  .ct-pcard.on .ct-pcard-weeks{color:#fff}
  .ct-wk-affix{font-size:12.5px;font-weight:650;color:var(--agent-text-muted)}
  .ct-pcard.on .ct-wk-affix{color:rgba(255,255,255,.82)}
  .ct-pcard-desc{margin:11px 0 0;font-size:13px;line-height:1.5;color:var(--agent-text-secondary)}
  .ct-pcard.on .ct-pcard-desc{color:rgba(255,255,255,.92)}

  .ct-cal{display:flex;flex-direction:column;gap:9px;width:100%;max-width:440px}
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
`;
