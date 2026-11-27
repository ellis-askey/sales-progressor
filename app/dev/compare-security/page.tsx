"use client";

// /dev/compare-security
//
// Before/after review for the canonical pass on Account > Security (Password,
// Two-step verification, Signed-in devices). These three cards use the account
// area's legacy account-btn / account-input classes; the already-signed-off
// account pages this session moved to LabelInput + arc Button, so Security
// follows to stay consistent with its siblings. Representative renders.

import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/ui/Badge";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LabelInput } from "@/components/ui/LabelInput";
import { Check } from "@/components/icons/ph";

const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

const fieldNow: React.CSSProperties = { width: "100%", padding: "10px 12px", fontSize: 13.5, color: "#111827", background: "#fff", border: "0.5px solid rgba(0,0,0,0.16)", borderRadius: 8, outline: "none" };
const labelNow: React.CSSProperties = { display: "block", fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 500, marginBottom: 5 };

export default function CompareSecurityPage() {
  const [pw, setPw] = useState("");
  return (
    <div className="cmp">
      <style>{CSS}</style>

      <header className="cmp-hd">
        <h1>Security &mdash; canonical pass</h1>
        <p>The last settings page: Password, Two-step verification, and Signed-in devices. The three cards still use the account area&rsquo;s older fields and buttons; the account pages already signed off this session moved to the standard floating-label fields and the standard buttons, so this brings Security in line. One real call is flagged (the two destructive buttons).</p>
      </header>

      {/* 1 fields */}
      <Card n={1} title="The password & code fields get the floating-label treatment" chip="existing">
        <p className="cmp-blurb">Current / new / confirm password, the 6-digit code, and the turn-off password are label-above-a-plain-box today. They become the standard floating-label fields used on Profile, and the password ones gain the standard show/hide eye.</p>
        <Cols>
          <Col label="Now">
            <label style={labelNow}>New password</label>
            <input style={fieldNow} type="password" defaultValue="hunter2abc" readOnly />
          </Col>
          <Col label="Proposed"><LabelInput field="Password" label="New password" size="sm" fullWidth accent="#FF6B4A" value={pw} onChange={(e) => setPw(e.target.value)} /></Col>
        </Cols>
      </Card>

      {/* 2 buttons */}
      <Card n={2} title="The buttons become the standard app button" chip="existing">
        <p className="cmp-blurb">The save actions (&ldquo;Change password&rdquo;, &ldquo;Set up two-step verification&rdquo;, &ldquo;Verify &amp; turn on&rdquo;, &ldquo;I&rsquo;ve saved these&rdquo;) become the standard coral button; the quieter ones (&ldquo;Cancel&rdquo;, &ldquo;Copy codes&rdquo;) become the standard white button. Same spinner-on-save behaviour.</p>
        <Cols>
          <Col label="Now">
            <div className="cmp-row"><button type="button" className="abp-now">Change password</button><button type="button" className="abs-now">Cancel</button></div>
          </Col>
          <Col label="Proposed">
            <div className="cmp-row"><Button variant="primary" size="md" style={coralVars}>Change password</Button><Button variant="secondary" size="md">Cancel</Button></div>
          </Col>
        </Cols>
      </Card>

      {/* 3 destructive */}
      <Card n={3} title="The two destructive buttons" chip="notsure">
        <p className="cmp-blurb">&ldquo;Turn off two-step verification&rdquo; and &ldquo;Sign out of all devices&rdquo; are white buttons with red text today. <b>Your call:</b> keep a red destructive signal (standard danger button, my recommendation for high-stakes security actions), or make them plain white like the Disconnect button on Connections?</p>
        <Cols>
          <Col label="Now"><button type="button" className="abs-now" style={{ color: "#b91c1c" }}>Sign out of all devices</button></Col>
          <Col label="Proposed">
            <div className="cmp-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
              <div><span className="cmp-tag">Option A &middot; recommended</span><div style={{ marginTop: 7 }}><Button variant="danger" size="md">Sign out of all devices</Button></div></div>
              <div><span className="cmp-tag">Option B &middot; plain</span><div style={{ marginTop: 7 }}><Button variant="secondary" size="md">Sign out of all devices</Button></div></div>
            </div>
          </Col>
        </Cols>
      </Card>

      {/* 4 badge */}
      <Card n={4} title="The two-step On/Off tag becomes the standard tag" chip="existing">
        <p className="cmp-blurb">The On/Off pill in the two-step card header is a filled colour chip. It becomes the standard outlined tag.</p>
        <Cols>
          <Col label="Now"><div className="cmp-row"><span className="pill-green">On</span><span className="pill-gray">Off</span></div></Col>
          <Col label="Proposed"><div className="cmp-row"><Badge tone="success">On</Badge><Badge tone="neutral">Off</Badge></div></Col>
        </Cols>
      </Card>

      {/* 5 errors */}
      <Card n={5} title="The error messages become the standard alert" chip="existing">
        <p className="cmp-blurb">Form-level errors (a wrong current password, a server error) become the standard bordered alert. The small inline field hints (&ldquo;Use at least 8 characters&rdquo;, &ldquo;the two passwords don&rsquo;t match&rdquo;) stay as a small line under the field, in the canonical danger colour.</p>
        <Cols>
          <Col label="Now">
            <p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>Your current password is incorrect.</p>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#dc2626" }}>Use at least 8 characters.</p>
          </Col>
          <Col label="Proposed">
            <InlineAlert kind="danger">Your current password is incorrect.</InlineAlert>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--agent-danger, #C73E3E)" }}>Use at least 8 characters.</p>
          </Col>
        </Cols>
      </Card>

      {/* leave */}
      <section className="cmp-sec">
        <h2>Left as-is <span className="chip chip-leave">on purpose</span></h2>
        <p className="cmp-secsub">The functional displays stay. Shown here:</p>
        <div className="gf-grid">
          <GF label="Backup codes + secret key" note="The backup-code grid and the authenticator secret key are monospace display blocks on a neutral surface, already fine, kept (greys warm later with the rest).">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "#f6f6f7", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 14, width: 220 }}>
              {["4f9a-2b1c", "7d3e-9m0k", "1a8b-5c2d", "6e4f-0g7h"].map((c) => <code key={c} style={{ fontSize: 12, letterSpacing: 1, color: "#111827", fontFamily: "ui-monospace, monospace" }}>{c}</code>)}
            </div>
          </GF>
          <GF label="The “is on” confirmation + inline confirm" note="The green “Two-step verification is on” check line and the inline “Sign out everywhere?” confirm step keep their semantics (the buttons inside them follow cards 2–3).">
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#166534", fontSize: 13, fontWeight: 600 }}><Check size={16} weight="bold" /> Two-step verification is on.</div>
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
    --agent-text-primary: #2D1810; --agent-text-secondary: #5A3A28; --agent-text-muted: #9a8a7f;
    --agent-border-default: rgba(20,16,10,0.14); --agent-border-subtle: rgba(20,16,10,0.08); --agent-surface-elevated: #fff; --agent-surface-subtle: rgba(45,24,16,0.03); --agent-danger: #C73E3E;
    max-width: 1000px; margin: 0 auto; padding: 40px 28px 120px; color: var(--agent-text-primary);
  }
  .cmp-hd h1 { font-size: 26px; font-weight: 800; margin: 0 0 8px; }
  .cmp-hd > p { font-size: 14px; line-height: 1.6; color: var(--agent-text-secondary); max-width: 820px; margin: 0; }
  .chip { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; border-radius: 6px; padding: 2px 7px; white-space: nowrap; }
  .chip-blue { color: #2563EB; border: 1px solid rgba(37,99,235,.4); } .chip-amber { color: #B07A1A; border: 1px solid rgba(201,125,26,.45); } .chip-leave { color: var(--agent-text-muted); border: 1px solid var(--agent-border-default); }
  .cmp-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--agent-text-muted); }

  .cmp-card { margin-top: 26px; border: 1px solid var(--agent-border-default); border-radius: 16px; overflow: hidden; background: #fff; }
  .cmp-card-hd { display: flex; gap: 13px; padding: 16px 20px; border-bottom: 1px solid var(--agent-border-subtle); align-items: flex-start; }
  .cmp-n { flex: 0 0 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: var(--agent-coral-deep); color: #fff; font-size: 13px; font-weight: 800; }
  .cmp-card-ttl { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; } .cmp-card-ttl h3 { font-size: 15.5px; font-weight: 720; margin: 2px 0; }
  .cmp-card-bd { padding: 18px 20px 22px; }
  .cmp-blurb { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); margin: 0 0 16px; max-width: 880px; }

  .cmp-cols { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--agent-border-subtle); border-radius: 12px; overflow: hidden; }
  .cmp-col { padding: 20px; min-width: 0; } .cmp-col:first-child { border-right: 1px solid var(--agent-border-subtle); background: rgba(45,24,16,0.015); }
  .cmp-col-lbl { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--agent-text-muted); margin-bottom: 14px; }
  .cmp-col-body { display: flex; flex-direction: column; align-items: flex-start; width: 100%; max-width: 320px; }
  .cmp-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

  .abp-now { font-family: inherit; cursor: pointer; border: none; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 500; color: #fff; background: var(--agent-coral, #FF6B4A); }
  .abs-now { font-family: inherit; cursor: pointer; border-radius: 8px; border: 0.5px solid rgba(0,0,0,0.16); background: #fff; color: #374151; font-size: 12.5px; font-weight: 500; padding: 8px 14px; }

  .pill-green { font-size: 11px; font-weight: 700; color: #166534; background: #dcfce7; padding: 3px 9px; border-radius: 999px; text-transform: uppercase; letter-spacing: .4px; }
  .pill-gray { font-size: 11px; font-weight: 700; color: #6b7280; background: #f3f4f6; padding: 3px 9px; border-radius: 999px; text-transform: uppercase; letter-spacing: .4px; }

  .cmp-sec { margin-top: 40px; border-top: 2px solid var(--agent-border-subtle); padding-top: 24px; }
  .cmp-sec h2 { font-size: 17px; font-weight: 760; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; }
  .cmp-secsub { font-size: 13px; color: var(--agent-text-secondary); margin: 0 0 18px; }
  .gf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .gf-item { border: 1px solid var(--agent-border-default); border-radius: 14px; overflow: hidden; background: #fff; }
  .gf-render { padding: 22px; display: flex; justify-content: center; background: rgba(45,24,16,0.015); border-bottom: 1px solid var(--agent-border-subtle); }
  .gf-meta { padding: 13px 16px; display: flex; flex-direction: column; gap: 3px; } .gf-meta strong { font-size: 13px; font-weight: 700; color: var(--agent-text-primary); } .gf-meta span { font-size: 12px; line-height: 1.5; color: var(--agent-text-muted); }

  @media (max-width: 760px) { .cmp-cols, .gf-grid { grid-template-columns: 1fr; } .cmp-col:first-child { border-right: 0; border-bottom: 1px solid var(--agent-border-subtle); } }
`;
