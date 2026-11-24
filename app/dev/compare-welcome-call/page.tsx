"use client";

// /dev/compare-welcome-call
//
// Before/after review for the canonical pass on Account > Welcome call.
// This editor is SHARED with the intro-call drawer on a file, so any change
// shows in both places. Colour + voice are already clean (no-op); the real
// work is a few buttons. Founder-call items shown both ways; leave-as-is items
// rendered so they can be seen. Status chip on every block.

import { useState } from "react";
import { Plus, Check, CaretUp, CaretDown, X, PencilSimple } from "@/components/icons/ph";
import { Button } from "@/components/arc/button/button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LabelInput } from "@/components/ui/LabelInput";

const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

const circleStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 99, flexShrink: 0,
  background: "radial-gradient(circle at 50% 32%, #ffffff 0%, var(--agent-coral-bg-tint) 100%)",
  border: "1px solid rgba(var(--agent-coral-rgb), 0.30)",
  boxShadow: "0 1px 3px rgba(var(--agent-coral-rgb), 0.22), inset 0 1px 0 rgba(255,255,255,0.85)",
  color: "var(--agent-coral-deep)", fontSize: 12.5, fontWeight: 800,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
const connectorStyle: React.CSSProperties = { flex: 1, width: 1.5, minHeight: 10, marginTop: 6, borderRadius: 2, background: "rgba(var(--agent-coral-rgb), 0.18)" };
const fieldStyle: React.CSSProperties = { width: "100%", padding: "7px 10px", fontSize: 13, color: "var(--agent-text-primary)", background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-default)", borderRadius: 8, outline: "none", fontFamily: "inherit", lineHeight: 1.5 };

export default function CompareWelcomeCallPage() {
  const [lv, setLv] = useState("");
  return (
    <div className="cmp">
      <style>{CSS}</style>

      <header className="cmp-hd">
        <h1>Welcome call &mdash; canonical pass</h1>
        <p>The script editor here is in good shape: the colours and wording are already correct. The only real changes are a few buttons. A couple of smaller things are judgement calls, shown both ways.</p>
        <div className="warn">
          <strong>⚠ Heads up:</strong> this exact editor also appears inside a file’s intro-call drawer (where each team member tweaks their own copy). Any change here shows in <b>both</b> places, so these swaps keep every size and behaviour identical.
        </div>
      </header>

      {/* 1 */}
      <Card n={1} title="The “Add a point” button loses its orange wash" chip="existing">
        <p className="cmp-blurb">Today it’s a dashed orange pill with a faint orange fill behind it. It becomes the standard white “secondary” button from the gallery (thin outline, the “+”, no fill). Same size and position.</p>
        <Cols>
          <Col label="Now"><button type="button" className="wcs-add-now"><Plus size={13} weight="bold" /> Add a point</button></Col>
          <Col label="Proposed"><Button variant="secondary" size="sm"><Plus size={13} weight="bold" /> Add a point</Button></Col>
        </Cols>
      </Card>

      {/* 2 */}
      <Card n={2} title="Save + Cancel become the standard app buttons" chip="existing">
        <p className="cmp-blurb">The glossy coral “Save script” and the plain “Cancel” become the standard buttons (Save gets the standard spinner while saving). Hover to compare.</p>
        <Cols>
          <Col label="Now">
            <div className="cmp-row">
              <button type="button" className="wcs-save-now"><Check size={14} weight="bold" /> Save script</button>
              <button type="button" className="wcs-cancel-now">Cancel</button>
            </div>
          </Col>
          <Col label="Proposed">
            <div className="cmp-row">
              <Button variant="primary" size="sm" style={coralVars}><Check size={14} weight="bold" /> Save script</Button>
              <Button variant="ghost" size="sm">Cancel</Button>
            </div>
          </Col>
        </Cols>
      </Card>

      {/* 3 */}
      <Card n={3} title="The red “error” line (a judgement call)" chip="notsure">
        <p className="cmp-blurb">When a save is blocked (e.g. no points), a small red line appears. It could become our standard bordered alert, or stay a quiet one-liner. I lean <b>quiet one-liner</b>: an alert box feels heavy for a single validation message right under the editor. Your call.</p>
        <Cols>
          <Col label="Now (quiet line)"><p style={{ margin: 0, fontSize: 12, color: "var(--agent-danger, #C73E3E)" }}>Add at least one talking point.</p></Col>
          <Col label="Option: standard alert"><InlineAlert kind="danger">Add at least one talking point.</InlineAlert></Col>
        </Cols>
      </Card>

      {/* 4 */}
      <Card n={4} title="The “Title” box (a judgement call)" chip="notsure">
        <p className="cmp-blurb">Each point’s “Title” is a plain box sitting directly above two bigger text boxes. It could get the floating-label treatment, or stay a plain box to match the two below it. I lean <b>leave it plain</b>: a floating label on just the title, with plain boxes under it, looks mismatched in this dense stack. Your call.</p>
        <Cols>
          <Col label="Now (plain, matches the boxes below)">
            <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 6 }}>
              <input className="agent-field" style={{ ...fieldStyle, fontWeight: 600 }} placeholder="Title" readOnly />
              <textarea className="agent-field" style={{ ...fieldStyle, resize: "none" }} rows={2} placeholder="What to say" readOnly />
            </div>
          </Col>
          <Col label="Option: floating label">
            <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 6 }}>
              <LabelInput field="Title" label="Title" fullWidth accent="#FF6B4A" value={lv} onChange={(e) => setLv(e.target.value)} />
              <textarea className="agent-field" style={{ ...fieldStyle, resize: "none" }} rows={2} placeholder="What to say" readOnly />
            </div>
          </Col>
        </Cols>
      </Card>

      {/* Already standard / no-op */}
      <section className="cmp-sec">
        <h2>Already right <span className="chip chip-ok">no change</span></h2>
        <p className="cmp-secsub">All the text colours already use the app’s warm greys, the hairlines are tokenised, and every word passes the voice rules (no dashes, “remove” not “delete”). Nothing to do there. The small “Reset to our default” link is already a muted text link (one tiny tidy possible to the hover colour, not worth a card).</p>
      </section>

      {/* Leave as-is - rendered */}
      <section className="cmp-sec">
        <h2>Left as-is <span className="chip chip-leave">rendered so you can see them</span></h2>
        <p className="cmp-secsub">These are the identity of the script and work well; they’re also shared with the drawer. Shown here:</p>
        <div className="gf-grid">
          <GF label="The coral numbered timeline" note="The numbered coral circles joined by a line ARE the look of the script (same as the intro-call drawer). The circle is a brand element, not a status pill, so it stays.">
            <div style={{ width: "100%", maxWidth: 360 }}>
              <Point n={1} title="Introduce yourself" body="Who you are and how you’ll help through the sale." last={false} />
              <Point n={2} title="What happens next" body="The key steps and roughly how long each takes." last />
            </div>
          </GF>
          <GF label="Row controls + edit pencil" note="The tiny up / down / remove icons on each row, and the pencil that opens edit mode. They’re the standard small icon controls (24-30px, already tokenised); arc buttons would be bulkier in this dense row. Left as-is.">
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span className="wcs-icon"><CaretUp size={13} weight="bold" /></span>
                <span className="wcs-icon"><CaretDown size={13} weight="bold" /></span>
                <span className="wcs-icon"><X size={13} weight="bold" /></span>
              </div>
              <span className="wcs-pencil"><PencilSimple size={15} weight="bold" /></span>
            </div>
          </GF>
        </div>
      </section>
    </div>
  );
}

function Point({ n, title, body, last }: { n: number; title: string; body: string; last: boolean }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <span style={circleStyle}>{n}</span>
        {!last && <span aria-hidden style={connectorStyle} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 4, paddingBottom: last ? 2 : 18, borderBottom: last ? "none" : "1px solid var(--agent-border-subtle)" }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{title}</p>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{body}</p>
      </div>
    </div>
  );
}

function Card({ n, title, chip, children }: { n: number; title: string; chip: "existing" | "notsure"; children: React.ReactNode }) {
  return (
    <section className="cmp-card">
      <div className="cmp-card-hd">
        <span className="cmp-n">{n}</span>
        <div className="cmp-card-ttl">
          <h3>{title}</h3>
          {chip === "existing" ? <span className="chip chip-blue">Existing canonical</span> : <span className="chip chip-amber">Your call</span>}
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
    --agent-coral: #FF6B4A; --agent-coral-deep: #E2452A; --agent-coral-rgb: 255,107,74; --agent-coral-bg-tint: rgba(255,107,74,0.10);
    --agent-text-primary: #2D1810; --agent-text-secondary: #5A3A28; --agent-text-muted: #9a8a7f; --agent-text-tertiary: #7A4A2E; --agent-text-on-coral: #fff;
    --agent-border-default: rgba(20,16,10,0.14); --agent-border-subtle: rgba(20,16,10,0.08); --agent-border-strong: rgba(20,16,10,0.22); --agent-surface-elevated: #fff; --agent-danger: #C73E3E;
    max-width: 1000px; margin: 0 auto; padding: 40px 28px 120px; color: var(--agent-text-primary);
  }
  .cmp-hd h1 { font-size: 26px; font-weight: 800; margin: 0 0 8px; }
  .cmp-hd > p { font-size: 14px; line-height: 1.6; color: var(--agent-text-secondary); max-width: 740px; margin: 0 0 14px; }
  .warn { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); background: rgba(201,125,26,0.07); border: 1px solid rgba(201,125,26,.3); border-radius: 12px; padding: 12px 15px; }
  .warn strong { color: #B07A1A; }

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
  .cmp-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

  /* Now reproductions */
  .wcs-add-now { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; font-size: 12.5px; font-weight: 600; color: var(--agent-coral-deep); background: rgba(var(--agent-coral-rgb),0.07); border: 0.5px dashed rgba(var(--agent-coral-rgb),0.40); border-radius: 9px; cursor: pointer; font-family: inherit; }
  .wcs-save-now { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 9px; font-size: 13px; font-weight: 600; color: #fff; border: none; cursor: pointer; font-family: inherit; background: linear-gradient(180deg, #FF8A65, #E2452A); box-shadow: 0 4px 14px rgba(226,69,42,.26); }
  .wcs-cancel-now { padding: 9px 14px; font-size: 13px; font-weight: 500; color: var(--agent-text-secondary); background: transparent; border: none; border-radius: 8px; cursor: pointer; font-family: inherit; }

  .agent-field { transition: border-color .12s ease; }
  .agent-field:focus { border-color: var(--agent-coral-deep) !important; }

  .wcs-icon { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; color: var(--agent-text-muted); }
  .wcs-pencil { width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; border: 0.5px solid var(--agent-border-default); background: var(--agent-surface-elevated); border-radius: 8px; color: var(--agent-text-secondary); }

  .cmp-sec { margin-top: 40px; border-top: 2px solid var(--agent-border-subtle); padding-top: 24px; }
  .cmp-sec h2 { font-size: 17px; font-weight: 760; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; }
  .cmp-secsub { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); margin: 0 0 18px; max-width: 840px; }
  .gf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .gf-item { border: 1px solid var(--agent-border-default); border-radius: 14px; overflow: hidden; background: #fff; }
  .gf-render { padding: 22px; display: flex; justify-content: center; background: rgba(45,24,16,0.015); border-bottom: 1px solid var(--agent-border-subtle); }
  .gf-meta { padding: 13px 16px; display: flex; flex-direction: column; gap: 3px; }
  .gf-meta strong { font-size: 13px; font-weight: 700; color: var(--agent-text-primary); }
  .gf-meta span { font-size: 12px; line-height: 1.5; color: var(--agent-text-muted); }

  @media (max-width: 760px) { .cmp-cols, .gf-grid { grid-template-columns: 1fr; } .cmp-col:first-child { border-right: 0; border-bottom: 1px solid var(--agent-border-subtle); } }
`;
