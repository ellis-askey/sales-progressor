"use client";

// /dev/compare-connect-crm
//
// Before/after review for the canonical pass on Account > Connect your CRM.
// This page is a single self-contained component (ConnectCrmPanel) that is
// already fairly polished and token-based; the canonical gaps are a small, tight
// set. Representative renders; a couple of real calls flagged.

import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/ui/Badge";
import { SearchField } from "@/components/ui/SearchField";
import { Check, ArrowRight } from "@/components/icons/ph";

const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

export default function CompareConnectCrmPage() {
  const [q, setQ] = useState("");
  return (
    <div className="cmp">
      <style>{CSS}</style>

      <header className="cmp-hd">
        <h1>Connect your CRM &mdash; canonical pass</h1>
        <p>This page is one tidy component and already uses the app&rsquo;s tokens and ring-based selection, so there&rsquo;s little to do. Four things: the search bar becomes the app&rsquo;s standard one, the buttons become the standard button, one &ldquo;half-built&rdquo; dashed box becomes solid, and the only colour-wash (the green &ldquo;Requested&rdquo; state) is de-washed. A couple of real calls are flagged &ldquo;your call&rdquo;.</p>
      </header>

      {/* 1 search */}
      <Card n={1} title="The search bar becomes the standard search field" chip="existing-notsure">
        <p className="cmp-blurb">The &ldquo;Find your CRM&rdquo; bar is a bespoke input. It becomes the app&rsquo;s standard search field (magnifier + a clear &times; once you type), the same one used elsewhere. <b>One call:</b> the standard field is a touch denser than the current tall, prominent bar &mdash; keep it standard (recommended, consistent), or keep a taller prominent bar for this landing page?</p>
        <Cols>
          <Col label="Now">
            <div className="ccrm-search-now">
              <svg width="19" height="19" viewBox="0 0 256 256" fill="currentColor" style={{ flex: "none", color: "#9a8a7f" }}><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" /></svg>
              <span style={{ color: "#9a8a7f", fontSize: 15 }}>Find your CRM...</span>
            </div>
          </Col>
          <Col label="Proposed"><div style={{ width: "100%", maxWidth: 360 }}><SearchField value={q} onChange={setQ} placeholder="Find your CRM…" ariaLabel="Find your CRM" /></div></Col>
        </Cols>
      </Card>

      {/* 2 request button */}
      <Card n={2} title="The tile “Request / Requested” control becomes standard" chip="existing-notsure">
        <p className="cmp-blurb">Each tile&rsquo;s &ldquo;Request&rdquo; button is a coral-outlined button that fills coral on hover; once requested it turns into a <b>green-tinted fill</b>. The button becomes the standard button, and the done state loses its fill &mdash; it becomes a green outlined &ldquo;Requested&rdquo; tag (no wash). <b>One call:</b> the standard set has no coral-outline button, so &ldquo;Request&rdquo; is either the quiet white button (recommended on a wall of tiles) or the loud coral one.</p>
        <Cols>
          <Col label="Now">
            <div className="cmp-row">
              <button type="button" className="ccrm-btn-now">Request</button>
              <button type="button" className="ccrm-btn-now done"><Check size={14} weight="bold" />Requested</button>
            </div>
          </Col>
          <Col label="Proposed">
            <div className="cmp-row">
              <Button variant="secondary" size="sm">Request</Button>
              <Badge tone="success" caps={false}><Check size={13} weight="bold" style={{ marginRight: 4 }} />Requested</Badge>
            </div>
          </Col>
        </Cols>
      </Card>

      {/* 3 other buttons */}
      <Card n={3} title="The other buttons become standard too" chip="existing">
        <p className="cmp-blurb">&ldquo;View all CRMs&rdquo; (already a near-standard button), &ldquo;Request it&rdquo; on the no-match row, and the &ldquo;Talk to our team&rdquo; concierge button all become the standard button &mdash; the concierge one the coral primary, the rest white.</p>
        <Cols>
          <Col label="Now">
            <div className="cmp-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
              <button type="button" className="ccrm-btn-now">Request it</button>
              <a className="ccrm-cta-now">Talk to our team <ArrowRight size={15} weight="bold" /></a>
            </div>
          </Col>
          <Col label="Proposed">
            <div className="cmp-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
              <Button variant="secondary" size="sm">Request it</Button>
              <Button variant="primary" size="md" style={coralVars}>Talk to our team <ArrowRight size={15} weight="bold" /></Button>
            </div>
          </Col>
        </Cols>
      </Card>

      {/* 4 no-result box */}
      <Card n={4} title="The no-match box stops looking half-built" chip="existing">
        <p className="cmp-blurb">When a search finds no CRM, the prompt sits in a <b>dashed</b> box (reads as unfinished). It becomes a solid hairline, like every other card.</p>
        <Cols>
          <Col label="Now">
            <div className="nores-now">
              <div><p style={{ margin: 0, fontSize: 14.5, fontWeight: 650, color: "var(--agent-text-primary)" }}>We don&rsquo;t list &ldquo;Acme&rdquo; yet</p><p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>Request it anyway and we&rsquo;ll add it to the roadmap.</p></div>
            </div>
          </Col>
          <Col label="Proposed">
            <div className="nores-prop">
              <div><p style={{ margin: 0, fontSize: 14.5, fontWeight: 650, color: "var(--agent-text-primary)" }}>We don&rsquo;t list &ldquo;Acme&rdquo; yet</p><p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>Request it anyway and we&rsquo;ll add it to the roadmap.</p></div>
            </div>
          </Col>
        </Cols>
      </Card>

      {/* leave */}
      <section className="cmp-sec">
        <h2>Left as-is <span className="chip chip-leave">on purpose</span></h2>
        <p className="cmp-secsub">The rest is already on-pattern. Shown here:</p>
        <div className="gf-grid">
          <GF label="Tile selection + hover" note="A requested/hovered tile already uses a coral ring + border (no colour-fill wash), which is exactly the canonical treatment. Kept.">
            <div style={{ width: 150, height: 56, borderRadius: 14, background: "var(--agent-surface-elevated)", border: "1px solid rgba(255,107,74,0.4)", boxShadow: "inset 0 0 0 1px rgba(255,107,74,0.24)", display: "grid", placeItems: "center", fontSize: 12, color: "var(--agent-text-muted)" }}>logo plate</div>
          </GF>
          <GF label="Concierge card, logo plates, toast" note="The concierge card and logo plates are already light token-based cards. The success toast is a working bespoke pill; the canonical Toast needs a provider wired into the layout, a bigger change I'd do only if you want it. Flagged, not assumed.">
            <div className="toast-demo"><Check size={15} weight="bold" style={{ color: "#5fe0a0" }} />You&rsquo;re on the list for Alto.</div>
          </GF>
        </div>
      </section>
    </div>
  );
}

function Card({ n, title, chip, children }: { n: number; title: string; chip: "existing" | "existing-notsure" | "notsure"; children: React.ReactNode }) {
  return (
    <section className="cmp-card">
      <div className="cmp-card-hd">
        <span className="cmp-n">{n}</span>
        <div className="cmp-card-ttl">
          <h3>{title}</h3>
          {chip === "existing" && <span className="chip chip-blue">Existing canonical</span>}
          {chip === "existing-notsure" && <><span className="chip chip-blue">Existing canonical</span><span className="chip chip-amber">1 to confirm</span></>}
          {chip === "notsure" && <span className="chip chip-amber">Your call</span>}
        </div>
      </div>
      <div className="cmp-card-bd">{children}</div>
    </section>
  );
}
function Cols({ children }: { children: React.ReactNode }) { return <div className="cmp-cols">{children}</div>; }
function Col({ label, children }: { label: string; children: React.ReactNode }) { return <div className="cmp-col"><span className="cmp-col-lbl">{label}</span><div className="cmp-col-body">{children}</div></div>; }
function GF({ label, note, children }: { label: string; note: string; children: React.ReactNode }) { return <div className="gf-item"><div className="gf-render">{children}</div><div className="gf-meta"><strong>{label}</strong><span>{note}</span></div></div>; }

const CSS = `
  .cmp {
    --agent-coral: #FF6B4A; --agent-coral-deep: #E2452A; --agent-coral-rgb: 255,107,74;
    --agent-text-primary: #2D1810; --agent-text-secondary: #5A3A28; --agent-text-muted: #9a8a7f; --agent-text-tertiary: #7A4A2E;
    --agent-border-default: rgba(20,16,10,0.14); --agent-border-subtle: rgba(20,16,10,0.08); --agent-surface-elevated: #fff; --agent-surface-subtle: rgba(45,24,16,0.03);
    max-width: 1000px; margin: 0 auto; padding: 40px 28px 120px; color: var(--agent-text-primary);
  }
  .cmp-hd h1 { font-size: 26px; font-weight: 800; margin: 0 0 8px; }
  .cmp-hd > p { font-size: 14px; line-height: 1.6; color: var(--agent-text-secondary); max-width: 820px; margin: 0; }
  .chip { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; border-radius: 6px; padding: 2px 7px; white-space: nowrap; }
  .chip-blue { color: #2563EB; border: 1px solid rgba(37,99,235,.4); } .chip-amber { color: #B07A1A; border: 1px solid rgba(201,125,26,.45); } .chip-leave { color: var(--agent-text-muted); border: 1px solid var(--agent-border-default); }

  .cmp-card { margin-top: 26px; border: 1px solid var(--agent-border-default); border-radius: 16px; overflow: hidden; background: #fff; }
  .cmp-card-hd { display: flex; gap: 13px; padding: 16px 20px; border-bottom: 1px solid var(--agent-border-subtle); align-items: flex-start; }
  .cmp-n { flex: 0 0 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: var(--agent-coral-deep); color: #fff; font-size: 13px; font-weight: 800; }
  .cmp-card-ttl { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; } .cmp-card-ttl h3 { font-size: 15.5px; font-weight: 720; margin: 2px 0; }
  .cmp-card-bd { padding: 18px 20px 22px; }
  .cmp-blurb { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); margin: 0 0 16px; max-width: 880px; }

  .cmp-cols { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--agent-border-subtle); border-radius: 12px; overflow: hidden; }
  .cmp-col { padding: 20px; min-width: 0; } .cmp-col:first-child { border-right: 1px solid var(--agent-border-subtle); background: rgba(45,24,16,0.015); }
  .cmp-col-lbl { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--agent-text-muted); margin-bottom: 14px; }
  .cmp-col-body { display: flex; flex-direction: column; align-items: flex-start; }
  .cmp-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

  .ccrm-search-now { display: flex; align-items: center; gap: 12px; width: 100%; max-width: 360px; padding: 0 18px; height: 54px; background: #fff; border: 1px solid var(--agent-border-subtle); border-radius: 15px; }
  .ccrm-btn-now { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--agent-coral-deep); background: transparent; color: var(--agent-coral-deep); font: inherit; font-size: 13px; font-weight: 650; padding: 8px 15px; border-radius: 11px; cursor: pointer; }
  .ccrm-btn-now.done { border-color: transparent; background: color-mix(in srgb, #2fa36b 14%, transparent); color: #2fa36b; }
  .ccrm-cta-now { display: inline-flex; align-items: center; gap: 7px; background: linear-gradient(180deg,#FF8A65,#E2452A); color: #fff; font-size: 13.5px; font-weight: 650; padding: 10px 17px; border-radius: 10px; box-shadow: 0 4px 14px rgba(226,69,42,.26); }

  .nores-now { width: 100%; max-width: 380px; padding: 18px; background: #fff; border: 1px dashed var(--agent-border-default); border-radius: 16px; }
  .nores-prop { width: 100%; max-width: 380px; padding: 18px; background: #fff; border: 1px solid var(--agent-border-subtle); border-radius: 16px; }

  .toast-demo { display: inline-flex; align-items: center; gap: 9px; background: var(--agent-text-primary); color: #fff; font-size: 13px; font-weight: 550; padding: 12px 18px; border-radius: 999px; box-shadow: 0 14px 40px rgba(10,12,22,0.3); }

  .cmp-sec { margin-top: 40px; border-top: 2px solid var(--agent-border-subtle); padding-top: 24px; }
  .cmp-sec h2 { font-size: 17px; font-weight: 760; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; }
  .cmp-secsub { font-size: 13px; color: var(--agent-text-secondary); margin: 0 0 18px; }
  .gf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .gf-item { border: 1px solid var(--agent-border-default); border-radius: 14px; overflow: hidden; background: #fff; }
  .gf-render { padding: 22px; display: flex; justify-content: center; background: rgba(45,24,16,0.015); border-bottom: 1px solid var(--agent-border-subtle); }
  .gf-meta { padding: 13px 16px; display: flex; flex-direction: column; gap: 3px; } .gf-meta strong { font-size: 13px; font-weight: 700; color: var(--agent-text-primary); } .gf-meta span { font-size: 12px; line-height: 1.5; color: var(--agent-text-muted); }

  @media (max-width: 760px) { .cmp-cols, .gf-grid { grid-template-columns: 1fr; } .cmp-col:first-child { border-right: 0; border-bottom: 1px solid var(--agent-border-subtle); } }
`;
