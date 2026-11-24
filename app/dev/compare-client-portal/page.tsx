"use client";

// /dev/compare-client-portal
//
// Before/after review for the canonical pass on Account > Client portal.
// Everything is covered: the handful of real changes (Now vs Proposed, live),
// the things already standard, and the things deliberately left alone (rendered
// so they can be seen). Every block carries a plain-English status chip.

import { useState } from "react";
import { Button } from "@/components/arc/button/button";

const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

export default function CompareClientPortalPage() {
  return (
    <div className="cmp">
      <style>{CSS}</style>

      <header className="cmp-hd">
        <h1>Client portal &mdash; canonical pass</h1>
        <p>
          This page is mostly in good shape already: all the on/off switches are the standard switch. The real work is
          small &mdash; swap three hand-built buttons for the standard app button, warm up some cool-grey text, and take a
          grey fill off one box. A good chunk of the page is a live preview of the actual client portal, which we leave
          exactly alone. Status chip on everything below.
        </p>
      </header>

      {/* 1 - buttons */}
      <Card n={1} title="Three buttons become the standard app button" chip="existing">
        <p className="cmp-blurb">The two “Preview the client portal” buttons and the “Explain it” button in the try-it box are hand-built today. They become the one standard button (hover them: it brightens and lifts). The small “Regenerate link” next to them is already the standard coral text link.</p>
        <Cols>
          <Col label="Now">
            <span className="cmp-mini">Preview portal buttons</span>
            <div className="cmp-row">
              <button type="button" className="ab ab-primary ab-sm">Open the example</button>
              <button type="button" className="ab ab-neutral ab-sm">Copy a link to share</button>
            </div>
            <span className="cmp-mini" style={{ marginTop: 16 }}>Try-it box button</span>
            <button type="button" className="ab-flat">Explain it</button>
          </Col>
          <Col label="Proposed">
            <span className="cmp-mini">Preview portal buttons</span>
            <div className="cmp-row">
              <Button variant="primary" size="sm" style={coralVars}>Open the example</Button>
              <Button variant="secondary" size="sm">Copy a link to share</Button>
            </div>
            <span className="cmp-mini" style={{ marginTop: 16 }}>Try-it box button</span>
            <Button variant="primary" size="sm" style={coralVars}>Explain it</Button>
          </Col>
        </Cols>
      </Card>

      {/* 2 - warm text */}
      <Card n={2} title="The cool-grey text warms up to match the rest of the app" chip="existing">
        <p className="cmp-blurb">The toggle-row titles and descriptions (and a couple of error lines) use a cool bluish grey. They move to the app’s warm greys. It’s a subtle shift: side by side you can see the warmth. Same change on every toggle row across the page.</p>
        <Cols>
          <Col label="Now">
            <div className="trow">
              <div>
                <p className="tt tt-cool">Invite clients when you add a sale</p>
                <p className="ts ts-cool">We’ll email the buyer and seller their portal link as soon as the sale is added.</p>
              </div>
              <Switch />
            </div>
          </Col>
          <Col label="Proposed">
            <div className="trow">
              <div>
                <p className="tt tt-warm">Invite clients when you add a sale</p>
                <p className="ts ts-warm">We’ll email the buyer and seller their portal link as soon as the sale is added.</p>
              </div>
              <Switch />
            </div>
          </Col>
        </Cols>
      </Card>

      {/* 3 - try-it de-wash */}
      <Card n={3} title="The “Try it yourself” result box loses its grey fill" chip="existing-notsure">
        <p className="cmp-blurb">When you test the explainer, the result currently sits in a grey-filled box. Per our no-filled-boxes rule it becomes a clean box with just a thin outline and warm text. The typing box keeps its outline (just warmed). <b>One to confirm:</b> this result box isn’t a warning/error, so it doesn’t fit our standard alert, so I’ve made it a plain thin-outline panel. Tell me if you’d rather a faint tint.</p>
        <Cols>
          <Col label="Now">
            <textarea className="ta ta-cool" rows={2} defaultValue="Paste a solicitor email here…" readOnly />
            <div className="out out-cool">Here’s what your client would get back, in plain English…</div>
          </Col>
          <Col label="Proposed">
            <textarea className="ta ta-warm" rows={2} defaultValue="Paste a solicitor email here…" readOnly />
            <div className="out out-warm">Here’s what your client would get back, in plain English…</div>
          </Col>
        </Cols>
      </Card>

      {/* Already standard */}
      <section className="cmp-sec">
        <h2>Already standard <span className="chip chip-ok">no change needed</span></h2>
        <p className="cmp-secsub">These are already the canonical parts, shown so you can see them.</p>
        <div className="gf-grid">
          <GF label="All on/off switches" note="Every switch on the page is the standard switch (LiquidToggle). Nothing to do.">
            <Switch />
          </GF>
          <GF label="“Regenerate link”" note="Changed to the login coral text link: colour shifts to a darker coral on hover, no underline.">
            <button type="button" className="agentlink">Regenerate link</button>
          </GF>
        </div>
      </section>

      {/* Left as-is */}
      <section className="cmp-sec">
        <h2>Left exactly as-is <span className="chip chip-leave">on purpose</span></h2>
        <p className="cmp-secsub">A big part of this page is a <b>live preview of the actual client portal</b>: what your buyers and sellers really see. It’s deliberately on a light background and styled to match the portal, not the agent app. Changing any of it would change the real client portal, so it stays. Rendered here so you can see it.</p>

        <div className="gf-grid">
          <GF label="The light preview backdrop + “Hidden” box" note="The light panel mimics the client’s portal screen. The dashed box is what shows when you switch something off.">
            <div className="pshell">
              <div className="hidden">
                <div className="hidden-eye">Hidden from clients</div>
                <div className="hidden-tx">The key dates won’t appear on any client portal.</div>
              </div>
            </div>
          </GF>

          <GF label="The welcome “Open” pill" note="A coral label inside the preview launcher card. It’s decoration inside a bigger clickable card, not a real button, so it stays.">
            <div className="welcome">
              <span>
                <span className="w-t">See it for yourself</span>
                <span className="w-s">Preview the welcome exactly as your clients will see it.</span>
              </span>
              <span className="w-pill">Open</span>
            </div>
          </GF>
        </div>

        <div className="gf-wide">
          <div className="gf-render">
            <div className="costs">
              <div className="costs-price">
                <span className="cp-lab">Example price</span>
                <span className="cp-chip"><span className="cp-pound">£</span><span className="cp-val">425,000</span></span>
              </div>
              <span className="cp-eye">After exchange</span>
              <button type="button" className="costs-launch">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><circle cx="12" cy="14" r="2.5" /></svg>
                <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                  <span className="cl-t">Your costs</span>
                  <span className="cl-s">See the full breakdown buyers receive after exchange. Tap to preview.</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>
          <div className="gf-meta">
            <strong>The “Your costs” preview (and example-price field)</strong>
            <span>This is the real stamp-duty / costs card as clients see it, in a light preview. The blue tint + cool greys deliberately match the client portal (not the agent app), so warming them would make the preview wrong. Left as-is.</span>
          </div>
        </div>

        <div className="gf-note">
          <strong>The four live portal cards (key dates, costs, progress, welcome)</strong>
          <span>These are the actual buyer/seller portal components, dropped in as live previews. They’re a different surface (light, mobile-first) and editing them changes what clients really see, out of scope for a settings tidy. You can see them in full on the real page; nothing changes here.</span>
        </div>
      </section>
    </div>
  );
}

function Switch() {
  return <span className="sw" aria-hidden><span className="sw-knob" /></span>;
}

function Card({ n, title, chip, children }: { n: number; title: string; chip: "existing" | "existing-notsure"; children: React.ReactNode }) {
  return (
    <section className="cmp-card">
      <div className="cmp-card-hd">
        <span className="cmp-n">{n}</span>
        <div className="cmp-card-ttl">
          <h3>{title}</h3>
          {chip === "existing" && <span className="chip chip-blue">Existing canonical</span>}
          {chip === "existing-notsure" && <><span className="chip chip-blue">Existing canonical</span><span className="chip chip-amber">1 to confirm</span></>}
        </div>
      </div>
      <div className="cmp-card-bd">{children}</div>
    </section>
  );
}

function Cols({ children }: { children: React.ReactNode }) { return <div className="cmp-cols">{children}</div>; }
function Col({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="cmp-col"><span className="cmp-col-lbl">{label}</span><div className="cmp-col-body">{children}</div></div>;
}
function GF({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return <div className="gf-item"><div className="gf-render">{children}</div><div className="gf-meta"><strong>{label}</strong><span>{note}</span></div></div>;
}

const CSS = `
  .cmp {
    --agent-coral: #FF6B4A; --agent-coral-deep: #E2452A; --agent-coral-rgb: 255,107,74;
    --agent-text-primary: #2D1810; --agent-text-secondary: #5A3A28; --agent-text-muted: #9a8a7f; --agent-text-tertiary: #7A4A2E; --agent-text-on-coral: #fff;
    --agent-border-default: rgba(20,16,10,0.14); --agent-border-subtle: rgba(20,16,10,0.08); --agent-surface-elevated: #fff;
    max-width: 1000px; margin: 0 auto; padding: 40px 28px 120px; color: var(--agent-text-primary);
  }
  .cmp-hd h1 { font-size: 26px; font-weight: 800; margin: 0 0 8px; }
  .cmp-hd > p { font-size: 14px; line-height: 1.6; color: var(--agent-text-secondary); max-width: 740px; margin: 0; }

  .chip { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; border-radius: 6px; padding: 2px 7px; white-space: nowrap; }
  .chip-blue { color: #2563EB; border: 1px solid rgba(37,99,235,.4); }
  .chip-amber { color: #B07A1A; border: 1px solid rgba(201,125,26,.45); }
  .chip-ok { color: #2F9E6B; border: 1px solid rgba(47,158,107,.4); }
  .chip-leave { color: var(--agent-text-muted); border: 1px solid var(--agent-border-default); }

  .cmp-card { margin-top: 28px; border: 1px solid var(--agent-border-default); border-radius: 16px; overflow: hidden; background: #fff; }
  .cmp-card-hd { display: flex; gap: 13px; padding: 16px 20px; border-bottom: 1px solid var(--agent-border-subtle); align-items: flex-start; }
  .cmp-n { flex: 0 0 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: var(--agent-coral-deep); color: #fff; font-size: 13px; font-weight: 800; }
  .cmp-card-ttl { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
  .cmp-card-ttl h3 { font-size: 15.5px; font-weight: 720; margin: 2px 0; }
  .cmp-card-bd { padding: 18px 20px 22px; }
  .cmp-blurb { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); margin: 0 0 16px; max-width: 840px; }

  .cmp-cols { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--agent-border-subtle); border-radius: 12px; overflow: hidden; }
  .cmp-col { padding: 20px; min-width: 0; }
  .cmp-col:first-child { border-right: 1px solid var(--agent-border-subtle); background: rgba(45,24,16,0.015); }
  .cmp-col-lbl { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--agent-text-muted); margin-bottom: 14px; }
  .cmp-col-body { display: flex; flex-direction: column; align-items: flex-start; }
  .cmp-mini { display: block; font-size: 11px; font-weight: 600; color: var(--agent-text-muted); margin-bottom: 8px; }
  .cmp-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

  /* Now buttons (approx of the agent-btn family) */
  .ab { font-family: inherit; cursor: pointer; border-radius: 10px; font-weight: 600; }
  .ab-sm { font-size: 13px; padding: 8px 14px; }
  .ab-primary { color: #fff; border: none; background: linear-gradient(180deg, #FF8A65, #E2452A); box-shadow: 0 4px 14px rgba(226,69,42,.26); }
  .ab-neutral { color: var(--agent-text-primary); background: #fff; border: 1px solid var(--agent-border-default); }
  .ab-flat { font-family: inherit; cursor: pointer; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; color: #fff; background: var(--agent-coral); padding: 8px 16px; }

  /* toggle row */
  .trow { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; width: 100%; }
  .tt { font-size: 14px; font-weight: 700; margin: 0; }
  .ts { font-size: 12.5px; line-height: 1.5; margin: 2px 0 0; }
  .tt-cool { color: #0f172a; } .ts-cool { color: #64748b; }
  .tt-warm { color: var(--agent-text-primary); } .ts-warm { color: var(--agent-text-muted); }

  /* fake switch (visual only) */
  .sw { flex: none; position: relative; width: 44px; height: 24px; border-radius: 999px; background: var(--agent-coral-deep); display: inline-block; margin-top: 2px; }
  .sw-knob { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border-radius: 999px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); }

  /* try-it */
  .ta { width: 100%; max-width: 360px; border-radius: 8px; padding: 10px; font-size: 13px; font-family: inherit; resize: none; color: var(--agent-text-muted); }
  .ta-cool { border: 1px solid #cbd5e1; } .ta-warm { border: 1px solid var(--agent-border-default); }
  .out { margin-top: 12px; max-width: 360px; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.5; }
  .out-cool { border: 1px solid #e2e8f0; background: #f8fafc; color: #334155; }
  .out-warm { border: 1px solid var(--agent-border-subtle); background: #fff; color: var(--agent-text-secondary); }

  .agentlink { font-family: inherit; background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 600; color: #FF6B4A; text-decoration: none; transition: color .12s ease; padding: 4px 2px; }
  .agentlink:hover { color: #E55B3D; }

  .cmp-sec { margin-top: 40px; border-top: 2px solid var(--agent-border-subtle); padding-top: 24px; }
  .cmp-sec h2 { font-size: 17px; font-weight: 760; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; }
  .cmp-secsub { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); margin: 0 0 18px; max-width: 840px; }

  .gf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .gf-item, .gf-wide { border: 1px solid var(--agent-border-default); border-radius: 14px; overflow: hidden; background: #fff; }
  .gf-wide { margin-top: 16px; }
  .gf-render { padding: 22px; display: flex; justify-content: center; background: rgba(45,24,16,0.015); border-bottom: 1px solid var(--agent-border-subtle); }
  .gf-meta { padding: 13px 16px; display: flex; flex-direction: column; gap: 3px; }
  .gf-meta strong { font-size: 13px; font-weight: 700; color: var(--agent-text-primary); }
  .gf-meta span { font-size: 12px; line-height: 1.5; color: var(--agent-text-muted); }
  .gf-note { margin-top: 16px; border: 1px dashed var(--agent-border-default); border-radius: 12px; padding: 15px 17px; display: flex; flex-direction: column; gap: 4px; }
  .gf-note strong { font-size: 13px; font-weight: 700; } .gf-note span { font-size: 12.5px; line-height: 1.55; color: var(--agent-text-muted); }

  /* left-as-is reproductions */
  .pshell { width: 100%; max-width: 340px; border-radius: 12px; background: #eef2f9; border: 1px solid var(--agent-border-subtle); padding: 14px; }
  .hidden { border-radius: 12px; border: 1px dashed var(--agent-border-default); padding: 20px 16px; text-align: center; background: #fff; }
  .hidden-eye { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--agent-text-muted); }
  .hidden-tx { margin-top: 4px; font-size: 12.5px; color: var(--agent-text-muted); }

  .welcome { display: flex; align-items: center; justify-content: space-between; gap: 12; width: 100%; max-width: 340px; background: var(--agent-surface-elevated); border: 1px solid var(--agent-border-default); border-radius: 12px; padding: 14px 16px; }
  .w-t { display: block; font-size: 13px; font-weight: 700; color: var(--agent-text-primary); }
  .w-s { display: block; font-size: 11.5px; color: var(--agent-text-muted); margin-top: 2px; }
  .w-pill { flex-shrink: 0; display: inline-flex; align-items: center; background: var(--agent-coral-deep); color: #fff; font-size: 12.5px; font-weight: 700; padding: 8px 16px; border-radius: 9px; }

  .costs { width: 100%; max-width: 460px; border-radius: 12px; background: #eef2f9; border: 1px solid var(--agent-border-subtle); padding: 14px; }
  .costs-price { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .cp-lab { font-size: 11.5px; font-weight: 600; color: #334155; }
  .cp-chip { display: inline-flex; align-items: center; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px 10px; }
  .cp-pound { color: #64748b; font-size: 13px; } .cp-val { font-size: 13px; font-weight: 700; color: #0f172a; margin-left: 2px; }
  .cp-eye { display: block; margin: 0 0 8px; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #64748b; }
  .costs-launch { display: flex; align-items: center; gap: 14px; width: 100%; cursor: pointer; font-family: inherit; border-radius: 16px; padding: 16px; background: linear-gradient(160deg, rgba(59,130,246,0.09), rgba(59,130,246,0.02)); border: 0.5px solid rgba(59,130,246,0.14); }
  .cl-t { display: block; font-size: 15px; font-weight: 700; color: #0f172a; }
  .cl-s { display: block; font-size: 12.5px; color: #475569; margin-top: 1px; }

  @media (max-width: 760px) { .cmp-cols, .gf-grid { grid-template-columns: 1fr; } .cmp-col:first-child { border-right: 0; border-bottom: 1px solid var(--agent-border-subtle); } }
`;
