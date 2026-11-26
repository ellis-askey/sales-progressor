"use client";

// /dev/compare-notifications
//
// Before/after review for the canonical pass on Account > Notifications.
// Three sections (Email / Mobile push / Paused files). Mobile push is "reused
// as-is" (its logic isn't touched); only safe visual swaps. Status chip on
// every block; leave-as-is items rendered.

import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/ui/Badge";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { ArrowRight, BellSlash, Bell, UploadSimple, Info } from "@/components/icons/ph";

const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

function Switch({ w = 44, h = 24, deep }: { w?: number; h?: number; deep?: boolean }) {
  return <span style={{ position: "relative", width: w, height: h, borderRadius: 999, background: deep ? "#E2452A" : "#FF8A65", display: "inline-block", flexShrink: 0 }}>
    <span style={{ position: "absolute", top: 2, right: 2, width: h - 4, height: h - 4, borderRadius: 999, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
  </span>;
}

export default function CompareNotificationsPage() {
  return (
    <div className="cmp">
      <style>{CSS}</style>

      <header className="cmp-hd">
        <h1>Notifications &mdash; canonical pass</h1>
        <p>More to tidy on this page than the last few: some cool-grey text, a few shaded boxes, three old buttons, a filled tag, and some status messages that should use our standard alert. One wording fix and one banned dash to remove. The switches are already the standard switch (one size question below).</p>
      </header>

      {/* 1 voice */}
      <Card n={1} title="Two small wording fixes" chip="voice">
        <Cols>
          <Col label="Now">
            <p className="cmp-copy"><span className="bad">Choose how and when Sales Progressor notifies you.</span> <span className="sub">(page subtitle)</span></p>
            <p className="cmp-copy"><span className="bad">Something went wrong &mdash; try again.</span> <span className="sub">(push error, has a banned dash)</span></p>
          </Col>
          <Col label="Proposed">
            <p className="cmp-copy"><span className="good">Choose how and when we notify you.</span></p>
            <p className="cmp-copy"><span className="good">Something went wrong. Try again.</span></p>
          </Col>
        </Cols>
        <p className="foot">The “automated client emails” wording on the Paused-files card is left as-is (“automated” describes the emails, it’s not the banned “the system automatically”).</p>
      </Card>

      {/* 2 greys */}
      <Card n={2} title="The cool-grey text warms up" chip="existing">
        <p className="cmp-blurb">Headings and descriptions across all three sections use cool bluish greys; they move to the app’s warm greys. No layout change (16 spots in total). Here’s a toggle row and a paused-file row as examples.</p>
        <Cols>
          <Col label="Now">
            <div className="trow"><div><p className="tt c-911">New enquiry raised</p><p className="ts c-6b">We’ll let you know the moment a solicitor raises one.</p></div><Switch /></div>
            <div className="file c-amber" style={{ marginTop: 14 }}><div><p className="tt c-911">12 Example Road, Harlow</p><p className="ts2 c-6b">Paused yesterday by Sam</p></div></div>
          </Col>
          <Col label="Proposed">
            <div className="trow"><div><p className="tt c-warm1">New enquiry raised</p><p className="ts c-warmm">We’ll let you know the moment a solicitor raises one.</p></div><Switch /></div>
            <div className="file c-amber" style={{ marginTop: 14 }}><div><p className="tt c-warm1">12 Example Road, Harlow</p><p className="ts2 c-warmm">Paused yesterday by Sam</p></div></div>
          </Col>
        </Cols>
      </Card>

      {/* 3 washed boxes - reworked */}
      <Card n={3} title="Shaded boxes: drop the colour, keep the presence" chip="existing">
        <p className="cmp-blurb">You were right that going fully white felt empty. New plan: the rows keep a <b>real surface and a proper border</b> (clearly “a thing”), but lose the coloured wash; the meaning moves to a small tag. The paused row gets a “Paused” tag; “this device” keeps its coral tag. And the iPhone install box is now a <b>proper step-by-step guide</b> (icon + heading + the app’s numbered coral steps), not a bare box.</p>
        <Cols>
          <Col label="Now (coloured wash)">
            <div className="file-amber-now">12 Example Road <span className="sub">· pale yellow fill</span></div>
            <div className="dev-now" style={{ marginTop: 10 }}>iPhone 15 <span className="sub">· pale orange fill</span></div>
            <div className="ios-now" style={{ marginTop: 10 }}>
              <p style={{ fontWeight: 600, margin: "0 0 4px" }}>To get push on iPhone, install the app first:</p>
              <ol style={{ margin: 0, paddingLeft: 18 }}><li>Tap Share in Safari</li><li>Add to Home Screen</li></ol>
            </div>
          </Col>
          <Col label="Proposed (surface + tag, no wash)">
            <div className="row2">
              <span style={{ minWidth: 0 }}><span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>12 Example Road</span><span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>Paused yesterday by Sam</span></span>
              <Badge tone="amber">Paused</Badge>
            </div>
            <div className="row2" style={{ marginTop: 10 }}>
              <span style={{ fontSize: 13, color: "var(--agent-text-primary)" }}>iPhone 15</span>
              <Badge tone="accent">This device</Badge>
            </div>
            <div className="iig" style={{ marginTop: 14 }}>
              <span className="iig-ic"><Bell size={20} weight="regular" /></span>
              <p className="iig-h">Enable notifications on your iPhone</p>
              <p className="iig-sub">Stay up to date with new messages and important updates, even when you’re not using the app.</p>
              <div className="iig-div" />
              <p className="iig-lead">First, add the app to your Home Screen</p>
              <div className="iig-steps">
                <div className="iig-step"><span className="iig-num">1.</span><span>Tap the <span style={{ whiteSpace: "nowrap" }}><b>Share</b> <UploadSimple size={13} weight="bold" className="iig-share" /></span> button in Safari.</span></div>
                <div className="iig-step"><span className="iig-num">2.</span><span>Scroll down and select <b>Add to Home Screen</b>.</span></div>
                <div className="iig-step"><span className="iig-num">3.</span><span>Tap <b>Add</b> in the top-right corner.</span></div>
                <div className="iig-step"><span className="iig-num">4.</span><span>Open the app from your Home Screen.</span></div>
                <div className="iig-step"><span className="iig-num">5.</span><span>Return to this page and select <b>Enable notifications</b>.</span></div>
              </div>
              <div className="iig-note"><Info size={14} weight="regular" /> You only need to do this once.</div>
            </div>
          </Col>
        </Cols>
      </Card>

      {/* 4 buttons */}
      <Card n={4} title="Four hand-built buttons become the standard app button" chip="existing">
        <p className="cmp-blurb">On the push card: “Enable on this device” (coral primary), “Send test push” and “Revoke” (white secondary). On a paused-file row: the “Open file →” pill becomes the standard white button with the standard arrow. Hover to compare.</p>
        <Cols>
          <Col label="Now">
            <div className="cmp-row">
              <button type="button" className="ab ab-primary ab-sm">Enable on this device</button>
              <button type="button" className="ab ab-ghost ab-sm">Send test push</button>
              <button type="button" className="ab ab-ghost ab-xs">Revoke</button>
            </div>
            <div style={{ marginTop: 12 }}><a className="openfile-now">Open file <ArrowRight size={12} weight="bold" /></a></div>
          </Col>
          <Col label="Proposed">
            <div className="cmp-row">
              <Button variant="primary" size="sm" style={coralVars}>Enable on this device</Button>
              <Button variant="secondary" size="sm">Send test push</Button>
              <Button variant="secondary" size="xs">Revoke</Button>
            </div>
            <div style={{ marginTop: 12 }}><Button variant="secondary" size="sm">Open file <ArrowRight size={12} weight="bold" /></Button></div>
          </Col>
        </Cols>
      </Card>

      {/* 5 badge */}
      <Card n={5} title="The “This device” tag becomes the standard outlined tag" chip="existing">
        <p className="cmp-blurb">The coral “THIS DEVICE” tag on your current browser’s row has a coral fill today; it becomes the standard outlined coral tag (same as elsewhere), no fill.</p>
        <Cols>
          <Col label="Now"><span className="pill-now">This device</span></Col>
          <Col label="Proposed"><Badge tone="accent">This device</Badge></Col>
        </Cols>
      </Card>

      {/* 6 inline alerts */}
      <Card n={6} title="Push status messages become the standard alert" chip="existing">
        <p className="cmp-blurb">The “permission denied / blocked / not available / error” lines become our standard bordered alert (amber for warnings, red for errors), so they match the rest of the app.</p>
        <Cols>
          <Col label="Now">
            <p className="amber-now">Permission denied. Click the lock icon, allow notifications, then try again.</p>
            <p className="red-now" style={{ marginTop: 8 }}>Something went wrong &mdash; try again.</p>
          </Col>
          <Col label="Proposed">
            <InlineAlert kind="warning">Permission denied. Click the lock icon, allow notifications, then try again.</InlineAlert>
            <div style={{ marginTop: 8 }}><InlineAlert kind="danger">Something went wrong. Try again.</InlineAlert></div>
          </Col>
        </Cols>
      </Card>

      {/* 7 switch size */}
      <Card n={7} title="The switches should all be one size (a judgement call)" chip="notsure">
        <p className="cmp-blurb">Right now the push card’s switches are slightly bigger and a deeper coral than the email card’s. I’d make them all match the email card (smaller, lighter coral) so the page reads as one switch. Your call on which wins.</p>
        <Cols>
          <Col label="Now">
            <span className="cmp-mini">Email card</span><Switch w={44} h={24} />
            <span className="cmp-mini" style={{ marginTop: 14 }}>Push card (bigger, deeper)</span><Switch w={48} h={28} deep />
          </Col>
          <Col label="Proposed (all match)">
            <span className="cmp-mini">Email card</span><Switch w={44} h={24} />
            <span className="cmp-mini" style={{ marginTop: 14 }}>Push card</span><Switch w={44} h={24} />
          </Col>
        </Cols>
      </Card>

      {/* leave */}
      <section className="cmp-sec">
        <h2>Already right / left as-is <span className="chip chip-ok">no change</span></h2>
        <p className="cmp-secsub">The card chrome, the section master-control header, and every on/off switch are already the standard parts (shown below). The whole mobile-push setup logic (permissions, iPhone detection, device handling) is reused untouched; only its colours and buttons change above.</p>
        <div className="gf-grid">
          <GF label="The standard on/off switch" note="Already the canonical switch (LiquidToggle) everywhere on the page."><Switch /></GF>
          <GF label="The paused-file empty state (real icon)" note="This is the actual icon: a bell-with-a-slash in the standard empty-state coral circle. (The “⌀” you saw earlier was just my lazy placeholder, sorry.) Already canonical; one invisible token swap only.">
            <div style={{ textAlign: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "50%", background: "rgba(var(--agent-coral-rgb),0.10)", color: "var(--agent-coral-deep)", marginBottom: 10 }}><BellSlash size={20} weight="bold" /></span>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>No files are paused</p>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--agent-text-tertiary)" }}>Automated emails are running normally.</p>
            </div>
          </GF>
        </div>
      </section>
    </div>
  );
}

function Card({ n, title, chip, children }: { n: number; title: string; chip: "voice" | "existing" | "existing-notsure" | "notsure"; children: React.ReactNode }) {
  return (
    <section className="cmp-card">
      <div className="cmp-card-hd">
        <span className="cmp-n">{n}</span>
        <div className="cmp-card-ttl">
          <h3>{title}</h3>
          {chip === "voice" && <span className="chip chip-blue">Voice fix</span>}
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
    --agent-text-primary: #2D1810; --agent-text-secondary: #5A3A28; --agent-text-muted: #9a8a7f; --agent-text-tertiary: #7A4A2E; --agent-text-on-coral: #fff;
    --agent-border-default: rgba(20,16,10,0.14); --agent-border-subtle: rgba(20,16,10,0.08); --agent-surface-elevated: #fff; --agent-danger: #C73E3E; --agent-warning: #C97D1A;
    max-width: 1000px; margin: 0 auto; padding: 40px 28px 120px; color: var(--agent-text-primary);
  }
  .cmp-hd h1 { font-size: 26px; font-weight: 800; margin: 0 0 8px; }
  .cmp-hd > p { font-size: 14px; line-height: 1.6; color: var(--agent-text-secondary); max-width: 760px; margin: 0; }

  .chip { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; border-radius: 6px; padding: 2px 7px; white-space: nowrap; }
  .chip-blue { color: #2563EB; border: 1px solid rgba(37,99,235,.4); }
  .chip-amber { color: #B07A1A; border: 1px solid rgba(201,125,26,.45); }
  .chip-ok { color: #2F9E6B; border: 1px solid rgba(47,158,107,.4); }

  .cmp-card { margin-top: 26px; border: 1px solid var(--agent-border-default); border-radius: 16px; overflow: hidden; background: #fff; }
  .cmp-card-hd { display: flex; gap: 13px; padding: 16px 20px; border-bottom: 1px solid var(--agent-border-subtle); align-items: flex-start; }
  .cmp-n { flex: 0 0 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: var(--agent-coral-deep); color: #fff; font-size: 13px; font-weight: 800; }
  .cmp-card-ttl { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
  .cmp-card-ttl h3 { font-size: 15.5px; font-weight: 720; margin: 2px 0; }
  .cmp-card-bd { padding: 18px 20px 22px; }
  .cmp-blurb { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); margin: 0 0 16px; max-width: 860px; }
  .foot { font-size: 12px; color: var(--agent-text-muted); margin: 12px 0 0; }

  .cmp-cols { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--agent-border-subtle); border-radius: 12px; overflow: hidden; }
  .cmp-col { padding: 20px; min-width: 0; }
  .cmp-col:first-child { border-right: 1px solid var(--agent-border-subtle); background: rgba(45,24,16,0.015); }
  .cmp-col-lbl { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--agent-text-muted); margin-bottom: 14px; }
  .cmp-col-body { display: flex; flex-direction: column; align-items: flex-start; }
  .cmp-mini { display: block; font-size: 11px; font-weight: 600; color: var(--agent-text-muted); margin-bottom: 8px; }
  .cmp-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .cmp-copy { font-size: 13.5px; margin: 0 0 10px; } .sub { font-size: 12px; color: var(--agent-text-muted); } .bad { text-decoration: line-through; color: var(--agent-text-muted); } .good { font-weight: 650; color: var(--agent-text-primary); }

  .trow { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; width: 100%; }
  .tt { font-size: 13.5px; font-weight: 600; margin: 0; } .ts { font-size: 12px; line-height: 1.55; margin: 3px 0 0; } .ts2 { font-size: 11.5px; margin: 2px 0 0; }
  .c-911 { color: #111827; } .c-6b { color: #6b7280; } .c-warm1 { color: var(--agent-text-primary); } .c-warmm { color: var(--agent-text-muted); }
  .file { width: 100%; max-width: 320px; border-radius: 8px; padding: 10px 14px; }
  .c-amber { background: rgba(254,243,199,0.30); border: 0.5px solid rgba(217,119,6,0.18); }

  .file-amber-now { width: 100%; max-width: 300px; font-size: 13px; padding: 10px 14px; border-radius: 8px; background: rgba(254,243,199,0.30); border: 0.5px solid rgba(217,119,6,0.18); color: var(--agent-text-primary); }
  .file-amber-prop { width: 100%; max-width: 300px; font-size: 13px; padding: 10px 14px; border-radius: 8px; background: transparent; border: 0.5px solid rgba(201,125,26,0.30); color: var(--agent-text-primary); }
  .dev-now { width: 100%; max-width: 300px; font-size: 13px; padding: 10px 14px; border-radius: 6px; background: rgba(255,237,213,0.40); border: 1px solid #fed7aa; color: var(--agent-text-primary); }
  .dev-prop { width: 100%; max-width: 300px; font-size: 13px; padding: 10px 14px; border-radius: 6px; background: transparent; border: 1px solid rgba(var(--agent-coral-rgb),0.30); color: var(--agent-text-primary); }
  .ios-now { width: 100%; max-width: 320px; font-size: 12px; padding: 12px; border-radius: 6px; background: #eff6ff; border: 1px solid #dbeafe; color: #1e3a8a; }
  /* reworked: neutral surface + proper border + semantic tag/accent (presence, no colour wash) */
  .row2 { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; max-width: 320px; padding: 11px 14px; border-radius: 10px; background: rgba(45,24,16,0.03); border: 1px solid var(--agent-border-subtle); }
  .ios2 { width: 100%; max-width: 320px; font-size: 12px; padding: 12px 12px 12px 13px; border-radius: 10px; background: rgba(45,24,16,0.03); border: 1px solid var(--agent-border-subtle); border-left: 3px solid rgba(37,99,235,0.55); }
  /* designed iPhone install guide (matches the real IosInstallGuide) */
  .iig { width: 100%; max-width: 400px; border: 1px solid var(--agent-border-default); border-radius: 16px; background: var(--agent-surface-elevated, #fff); padding: 22px 24px; box-shadow: 0 1px 2px rgba(60,40,22,.04); }
  .iig-ic { display: inline-flex; width: 40px; height: 40px; border-radius: 11px; align-items: center; justify-content: center; background: rgba(45,24,16,0.06); color: var(--agent-text-primary); margin-bottom: 14px; }
  .iig-h { margin: 0 0 6px; font-size: 16.5px; font-weight: 720; color: var(--agent-text-primary); letter-spacing: -0.01em; }
  .iig-sub { margin: 0; font-size: 13px; line-height: 1.5; color: var(--agent-text-muted); }
  .iig-div { height: 1px; background: var(--agent-border-subtle); margin: 16px 0; }
  .iig-lead { margin: 0 0 14px; font-size: 13px; font-weight: 700; color: var(--agent-text-primary); }
  .iig-steps { display: flex; flex-direction: column; gap: 13px; }
  .iig-step { display: flex; gap: 10px; font-size: 13.5px; line-height: 1.5; color: var(--agent-text-secondary); }
  .iig-step b { color: var(--agent-text-primary); font-weight: 700; }
  .iig-num { font-weight: 700; color: var(--agent-text-primary); flex-shrink: 0; }
  .iig-share { vertical-align: -2px; }
  .iig-note { display: flex; align-items: center; gap: 7px; margin-top: 16px; padding: 10px 12px; border-radius: 9px; background: rgba(45,24,16,0.04); font-size: 12.5px; color: var(--agent-text-muted); }

  .ab { font-family: inherit; cursor: pointer; border-radius: 9px; font-weight: 600; }
  .ab-sm { font-size: 13px; padding: 8px 14px; } .ab-xs { font-size: 11px; padding: 5px 10px; }
  .ab-primary { color: #fff; border: none; background: linear-gradient(180deg, #FF8A65, #E2452A); box-shadow: 0 4px 14px rgba(226,69,42,.26); }
  .ab-ghost { color: var(--agent-coral-deep); background: #fff; border: 1px solid rgba(var(--agent-coral-rgb),0.5); }
  .openfile-now { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; font-size: 12px; font-weight: 600; color: var(--agent-coral-deep); background: #fff; border: 0.5px solid rgba(0,0,0,0.14); border-radius: 6px; text-decoration: none; cursor: pointer; }

  .pill-now { display: inline-flex; align-items: center; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 3px 8px; border-radius: 999px; color: var(--agent-coral-deep); background: rgba(var(--agent-coral-rgb),0.12); border: 1px solid rgba(var(--agent-coral-rgb),0.2); }
  .amber-now { margin: 0; font-size: 12px; color: #b45309; max-width: 360px; } .red-now { margin: 0; font-size: 12px; color: #b91c1c; }

  .cmp-sec { margin-top: 40px; border-top: 2px solid var(--agent-border-subtle); padding-top: 24px; }
  .cmp-sec h2 { font-size: 17px; font-weight: 760; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; }
  .cmp-secsub { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); margin: 0 0 18px; max-width: 860px; }
  .gf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .gf-item { border: 1px solid var(--agent-border-default); border-radius: 14px; overflow: hidden; background: #fff; }
  .gf-render { padding: 22px; display: flex; justify-content: center; background: rgba(45,24,16,0.015); border-bottom: 1px solid var(--agent-border-subtle); }
  .gf-meta { padding: 13px 16px; display: flex; flex-direction: column; gap: 3px; }
  .gf-meta strong { font-size: 13px; font-weight: 700; color: var(--agent-text-primary); } .gf-meta span { font-size: 12px; line-height: 1.5; color: var(--agent-text-muted); }

  @media (max-width: 760px) { .cmp-cols, .gf-grid { grid-template-columns: 1fr; } .cmp-col:first-child { border-right: 0; border-bottom: 1px solid var(--agent-border-subtle); } }
`;
