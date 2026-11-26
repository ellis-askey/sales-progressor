"use client";

// /dev/compare-connections
//
// Before/after review for the canonical pass on Account > Connections. This is
// the biggest page by far (~27 changes across 10 files, incl. a whole legacy
// "glass" sub-world). Grouped into digestible cards; founder-decision items
// flagged; leave-as-is items rendered. Representative renders (not every single
// instance). Implementation will be staged after approval.

import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/ui/Badge";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LabelInput } from "@/components/ui/LabelInput";
import { Plus, CheckCircle, ArrowUpRight, ShieldCheck } from "@/components/icons/ph";

const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

export default function CompareConnectionsPage() {
  const [v, setV] = useState({ email: "", pw: "" });
  return (
    <div className="cmp">
      <style>{CSS}</style>

      <header className="cmp-hd">
        <h1>Connections &mdash; canonical pass</h1>
        <p>By far the biggest page: the connect cards (Outlook / email / WhatsApp), the connection grid, and the sending-address setup. Two things stand out: (1) a lot of standard swaps (buttons, status tags, alert boxes, form fields), and (2) the whole <b>sending-address setup still uses an old “frosted glass” look</b> that reads like a different app inside this page. I’ll do it in stages once you’ve approved. A few real design calls below are flagged “your call”.</p>
        <div className="warn"><strong>Heads up:</strong> this is a large, staged job. Nothing here is a one-click change &mdash; it’s the plan. Approve the groups you want and answer the flagged calls, and I’ll work through it in commits.</div>
      </header>

      {/* 1 connect buttons */}
      <Card n={1} title="The connect buttons become the standard app button" chip="existing">
        <p className="cmp-blurb">Every “Connect” button (Connect Outlook / Connect email / Show my QR code), plus the Continue / Verify / Check buttons in the sending-address setup, is the old glossy coral button. They all become the standard coral button with the standard spinner.</p>
        <Cols>
          <Col label="Now"><button type="button" className="legacy-primary">Connect my inbox</button></Col>
          <Col label="Proposed"><Button variant="primary" size="md" style={coralVars}>Connect my inbox</Button></Col>
        </Cols>
      </Card>

      {/* 2 secondary buttons */}
      <Card n={2} title="The white “Disconnect / Manage / Check / Send test” buttons become standard" chip="existing-notsure">
        <p className="cmp-blurb">The white action buttons on each card become the standard white button. <b>One call for you:</b> the “Disconnect” on the email card turns red on hover today (a “this removes something” signal). Our standard button set is primary / secondary / ghost, no red. Keep a red hover as an exception, or make Disconnect a plain neutral button?</p>
        <Cols>
          <Col label="Now">
            <div className="cmp-row"><button type="button" className="legacy-sec">Manage</button><button type="button" className="legacy-sec legacy-sec-danger">Disconnect</button></div>
          </Col>
          <Col label="Proposed">
            <div className="cmp-row"><Button variant="secondary" size="sm">Manage</Button><Button variant="secondary" size="sm">Disconnect</Button></div>
          </Col>
        </Cols>
      </Card>

      {/* 3 pills */}
      <Card n={3} title="The coloured status tags become the standard outlined tags" chip="existing">
        <p className="cmp-blurb">Every “Connected / Pending / Sending on / Not connected / Verified / Expired” tag is a filled colour chip today; they become the app’s standard outlined tags (same colours, no fill). Eight groups of these across the page.</p>
        <Cols>
          <Col label="Now">
            <div className="cmp-row">
              <span className="pill pill-green">Connected</span>
              <span className="pill pill-amber">Pending</span>
              <span className="pill pill-green">Sending on</span>
              <span className="pill pill-gray">Not connected</span>
              <span className="pill pill-red">Expired</span>
            </div>
          </Col>
          <Col label="Proposed">
            <div className="cmp-row">
              <Badge tone="success" caps={false}>Connected</Badge>
              <Badge tone="amber" caps={false}>Pending</Badge>
              <Badge tone="success" caps={false}>Sending on</Badge>
              <Badge tone="neutral" caps={false}>Not connected</Badge>
              <Badge tone="danger" caps={false}>Expired</Badge>
            </div>
          </Col>
        </Cols>
      </Card>

      {/* 4 alerts */}
      <Card n={4} title="The coloured message boxes become the standard alert" chip="existing-notsure">
        <p className="cmp-blurb">The “inbox connected” / “DNS setup required” / error boxes are filled colour boxes; they become the standard bordered alert. <b>One call:</b> a few are two-liners with a bold title + a paragraph (e.g. “DNS setup required…”), which don’t fit our single-line alert. Keep them as a slightly richer bordered box, or should I build a small “titled alert” variant for these?</p>
        <Cols>
          <Col label="Now">
            <div className="box box-green">Your inbox is connected.</div>
            <div className="box box-amber" style={{ marginTop: 8 }}><b>DNS setup required.</b> Add the records below, then check again.</div>
            <div className="box box-red" style={{ marginTop: 8 }}>We couldn’t connect that inbox. Check the password and try again.</div>
          </Col>
          <Col label="Proposed">
            <InlineAlert kind="success">Your inbox is connected.</InlineAlert>
            <div style={{ marginTop: 8 }}><InlineAlert kind="warning"><b>DNS setup required.</b> Add the records below, then check again.</InlineAlert></div>
            <div style={{ marginTop: 8 }}><InlineAlert kind="danger">We couldn’t connect that inbox. Check the password and try again.</InlineAlert></div>
          </Col>
        </Cols>
      </Card>

      {/* 5 inputs */}
      <Card n={5} title="The email connect form fields get the floating-label treatment" chip="existing">
        <p className="cmp-blurb">The “Email address / App password / IMAP host / Port” boxes (and the add-address + IT-email fields) become the floating-label fields used on Profile. The password one gets the standard show/hide eye. Hints like “most use port 993” move to a small line under the field.</p>
        <Cols>
          <Col label="Now">
            <label className="fld"><span className="fld-lbl">Email address</span><input className="fld-in" placeholder="you@youragency.co.uk" readOnly /></label>
            <label className="fld" style={{ marginTop: 10 }}><span className="fld-lbl">App password</span><input className="fld-in" type="password" defaultValue="xxxxxxxx" readOnly /></label>
          </Col>
          <Col label="Proposed">
            <LabelInput field="Email address" label="Email address" size="sm" fullWidth accent="#FF6B4A" value={v.email} onChange={(e) => setV((s) => ({ ...s, email: e.target.value }))} />
            <div style={{ marginTop: 10 }}><LabelInput field="Password" label="App password" size="sm" fullWidth accent="#FF6B4A" value={v.pw} onChange={(e) => setV((s) => ({ ...s, pw: e.target.value }))} /></div>
          </Col>
        </Cols>
      </Card>

      {/* 6 provider guide */}
      <Card n={6} title="The provider setup steps become a proper numbered guide" chip="existing">
        <p className="cmp-blurb">When you pick a provider (e.g. Gmail), the app-password steps showed in a coral-washed box with a plain numbered list. They become the <b>“Connect your Gmail account” card you attached</b>: a clean light card with a heading + subtitle, a hairline divider, bold numbered steps with an “open page ↗” link, and a shield footnote. This is what&rsquo;s now built and live (shown faithfully below).</p>
        <Cols>
          <Col label="Now">
            <div className="guide-now">
              <p style={{ fontWeight: 600, margin: "0 0 6px", color: "#111827" }}>Connect your Gmail</p>
              <ol style={{ margin: 0, paddingLeft: 18, color: "#374151", fontSize: 12.5, lineHeight: 1.6 }}>
                <li>Turn on 2-Step Verification for your Google account if it isn&rsquo;t already on.</li>
                <li>Open your <span style={{ color: "#FF6B4A", fontWeight: 600, textDecoration: "underline" }}>Google app passwords page</span> and sign in.</li>
                <li>Create an app password, copy it and paste it below.</li>
              </ol>
              <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "#6b7280", lineHeight: 1.5 }}>Use the app password here, not your normal Gmail password. We&rsquo;ve already filled in the server settings for you.</p>
            </div>
          </Col>
          <Col label="Proposed (built + live)">
            <div className="pgd">
              <p className="pgd-h">Connect your Gmail account</p>
              <p className="pgd-sub">To connect securely, you&rsquo;ll create an app password through your Google Account.</p>
              <div className="pgd-div" />
              <ol className="pgd-steps">
                <li>
                  <p className="pgd-sth">1. Enable 2-Step Verification</p>
                  <p className="pgd-stb">App passwords are only available once 2-Step Verification is on in your Google Account security settings.</p>
                </li>
                <li>
                  <p className="pgd-sth">2. Create an app password</p>
                  <p className="pgd-stb">Generate one named &lsquo;Sales Progressor&rsquo; on your Google app passwords page.</p>
                  <a className="pgd-link" href="#" onClick={(e) => e.preventDefault()}>Create app password <ArrowUpRight size={13} weight="bold" /></a>
                </li>
                <li>
                  <p className="pgd-sth">3. Enter your app password</p>
                  <p className="pgd-stb">Copy the 16-character password and paste it into the field below. You&rsquo;ll only see it once.</p>
                </li>
              </ol>
              <div className="pgd-note">
                <ShieldCheck size={16} weight="regular" style={{ flex: "none", marginTop: 1, color: "var(--agent-text-muted)" }} />
                <span>An app password lets you connect securely without sharing your normal Gmail password. We&rsquo;ve already filled in the server settings for you.</span>
              </div>
            </div>
          </Col>
        </Cols>
      </Card>

      {/* 7 glass world */}
      <Card n={7} title="The sending-address setup stops looking like a different app" chip="notsure">
        <p className="cmp-blurb">This is the biggest consistency gap. The “Sending addresses” setup (add address, domain records, 6-digit verify) still uses an old <b>frosted-glass</b> look with cool blue-grey text, sitting inside a normal card, so it reads like a separate app. It should move to the same clean, warm look as everything else. <b>This changes a shipped appearance, so it’s your call to green-light.</b></p>
        <Cols>
          <Col label="Now (frosted glass + cool greys)">
            <div className="glass-now">
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "rgba(15,23,42,0.9)" }}>sam@youragency.co.uk</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(15,23,42,0.5)" }}>Added 3 days ago</p>
              <p style={{ margin: "8px 0 0", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "#3b82f6" }}>Step 1 of 2</p>
            </div>
          </Col>
          <Col label="Proposed (clean + warm)">
            <div className="glass-prop">
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>sam@youragency.co.uk</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>Added 3 days ago</p>
              <p style={{ margin: "8px 0 0", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--agent-text-muted)" }}>Step 1 of 2</p>
            </div>
          </Col>
        </Cols>
      </Card>

      {/* 8 OTP */}
      <Card n={8} title="The 6-digit code boxes use coral instead of blue" chip="existing">
        <p className="cmp-blurb">The verification-code boxes highlight in cold blue when you type. They keep their shape (it’s a nice bespoke control) but highlight in brand coral instead.</p>
        <Cols>
          <Col label="Now"><div className="otp">{["4", "9", "", "", "", ""].map((d, i) => <span key={i} className={`otp-box${d ? " otp-blue" : ""}`}>{d}</span>)}</div></Col>
          <Col label="Proposed"><div className="otp">{["4", "9", "", "", "", ""].map((d, i) => <span key={i} className={`otp-box${d ? " otp-coral" : ""}`}>{d}</span>)}</div></Col>
        </Cols>
      </Card>

      {/* 9 empty state */}
      <Card n={9} title="The dashed “empty” box becomes a solid, warm one" chip="existing">
        <p className="cmp-blurb">The sending-address empty state uses a dashed border (reads as half-built) and cool greys. It becomes a solid hairline with warm text.</p>
        <Cols>
          <Col label="Now"><div className="empty-now"><p style={{ margin: 0, fontWeight: 600, color: "#374151" }}>No sending addresses yet</p><p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9ca3af" }}>Add your work email to send from it.</p></div></Col>
          <Col label="Proposed"><div className="empty-prop"><p style={{ margin: 0, fontWeight: 600, color: "var(--agent-text-secondary)" }}>No sending addresses yet</p><p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--agent-text-tertiary)" }}>Add your work email to send from it.</p></div></Col>
        </Cols>
      </Card>

      {/* 10 voice + greys */}
      <Card n={10} title="Wording + a big colour sweep" chip="notsure">
        <p className="cmp-blurb"><b>Em-dashes</b> (banned) in ~8 strings get fixed (e.g. “Step 1 of 2 &mdash; Domain authentication” becomes “Step 1 of 2: Domain authentication”). <b>Cool greys</b> (the whole page uses cool slate/grey) move to the warm app greys, a big but invisible sweep across all 10 files. <b>One call:</b> the word “automatically” appears ~8 times (“automatically match emails…”). The house style prefers “we’ll”. Replace all, or leave the pervasive ones?</p>
        <Cols>
          <Col label="Now"><p className="cmp-copy"><span className="bad">Step 1 of 2 &mdash; Domain authentication</span></p><p className="cmp-copy"><span className="bad">…to automatically match emails…</span></p></Col>
          <Col label="Proposed"><p className="cmp-copy"><span className="good">Step 1 of 2: Domain authentication</span></p><p className="cmp-copy"><span className="good">…to match emails for you…</span> <span className="sub">(your call)</span></p></Col>
        </Cols>
      </Card>

      {/* leave */}
      <section className="cmp-sec">
        <h2>Left as-is <span className="chip chip-leave">on purpose</span></h2>
        <p className="cmp-secsub">Provider identity and already-standard parts stay. Shown here:</p>
        <div className="gf-grid">
          <GF label="Provider brand colours + logos" note="Gmail / Outlook / WhatsApp logos and their brand colours (Microsoft blue, WhatsApp green #25D366) are the providers’ identity, left exactly as-is.">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: "#25D366", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800 }}>W</span>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: "#0f6cbd", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800 }}>O</span>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: "#fff", border: "1px solid var(--agent-border-default)", display: "grid", placeItems: "center", color: "#ea4335", fontWeight: 800 }}>G</span>
            </div>
          </GF>
          <GF label="On/off switch, code-box shape, status dots" note="The auto-tasks switch is already the standard switch; the 6-digit code layout and the small status dots keep their shape (colours only change). The modal dim-background stays neutral.">
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <span style={{ position: "relative", width: 44, height: 24, borderRadius: 999, background: "#FF8A65", display: "inline-block" }}><span style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: 999, background: "#fff" }} /></span>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#2F9E6B" }} />
              <CheckCircle size={20} weight="fill" style={{ color: "#2F9E6B" }} />
            </div>
          </GF>
        </div>
      </section>

      <p className="tail"><Plus size={13} weight="bold" style={{ verticalAlign: -2 }} /> Also on the list (not individually drawn): status greens standardised to #2F9E6B (WhatsApp green kept), the provider-picker + Gmail-tile active states de-washed to a ring; the modal close becomes the standard icon button, and the full cool-grey → warm-token sweep across all 10 files.</p>
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
    --agent-coral: #FF6B4A; --agent-coral-deep: #E2452A; --agent-coral-rgb: 255,107,74; --agent-coral-bg-tint: rgba(255,107,74,0.10);
    --agent-text-primary: #2D1810; --agent-text-secondary: #5A3A28; --agent-text-muted: #9a8a7f; --agent-text-tertiary: #7A4A2E; --agent-text-on-coral: #fff;
    --agent-border-default: rgba(20,16,10,0.14); --agent-border-subtle: rgba(20,16,10,0.08); --agent-surface-elevated: #fff; --agent-surface-subtle: rgba(45,24,16,0.03); --agent-danger: #C73E3E; --agent-warning: #C97D1A;
    max-width: 1000px; margin: 0 auto; padding: 40px 28px 120px; color: var(--agent-text-primary);
  }
  .cmp-hd h1 { font-size: 26px; font-weight: 800; margin: 0 0 8px; }
  .cmp-hd > p { font-size: 14px; line-height: 1.6; color: var(--agent-text-secondary); max-width: 780px; margin: 0 0 14px; }
  .warn { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); background: rgba(201,125,26,0.07); border: 1px solid rgba(201,125,26,.3); border-radius: 12px; padding: 12px 15px; }
  .warn strong { color: #B07A1A; }
  .chip { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; border-radius: 6px; padding: 2px 7px; white-space: nowrap; }
  .chip-blue { color: #2563EB; border: 1px solid rgba(37,99,235,.4); } .chip-amber { color: #B07A1A; border: 1px solid rgba(201,125,26,.45); } .chip-leave { color: var(--agent-text-muted); border: 1px solid var(--agent-border-default); }

  .cmp-card { margin-top: 26px; border: 1px solid var(--agent-border-default); border-radius: 16px; overflow: hidden; background: #fff; }
  .cmp-card-hd { display: flex; gap: 13px; padding: 16px 20px; border-bottom: 1px solid var(--agent-border-subtle); align-items: flex-start; }
  .cmp-n { flex: 0 0 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: var(--agent-coral-deep); color: #fff; font-size: 13px; font-weight: 800; }
  .cmp-card-ttl { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; } .cmp-card-ttl h3 { font-size: 15.5px; font-weight: 720; margin: 2px 0; }
  .cmp-card-bd { padding: 18px 20px 22px; }
  .cmp-blurb { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); margin: 0 0 16px; max-width: 860px; }

  .cmp-cols { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--agent-border-subtle); border-radius: 12px; overflow: hidden; }
  .cmp-col { padding: 20px; min-width: 0; } .cmp-col:first-child { border-right: 1px solid var(--agent-border-subtle); background: rgba(45,24,16,0.015); }
  .cmp-col-lbl { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--agent-text-muted); margin-bottom: 14px; }
  .cmp-col-body { display: flex; flex-direction: column; align-items: flex-start; }
  .cmp-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .cmp-copy { font-size: 13.5px; margin: 0 0 10px; } .sub { font-size: 12px; color: var(--agent-text-muted); } .bad { text-decoration: line-through; color: var(--agent-text-muted); } .good { font-weight: 650; color: var(--agent-text-primary); }

  .legacy-primary { font-family: inherit; cursor: pointer; border: none; border-radius: 10px; padding: 10px 18px; font-size: 13.5px; font-weight: 650; color: #fff; background: linear-gradient(180deg, #FF8A65, #E2452A); box-shadow: 0 4px 14px rgba(226,69,42,.26); }
  .legacy-sec { font-family: inherit; cursor: pointer; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; color: #374151; font-size: 13px; font-weight: 500; padding: 7px 13px; }
  .legacy-sec-danger:hover { border-color: #fecaca; background: #fef2f2; color: #b91c1c; }

  .pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; display: inline-flex; align-items: center; }
  .pill-green { color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; } .pill-amber { color: #b45309; background: #fffbeb; border: 1px solid #fde68a; } .pill-gray { color: #6b7280; background: #f9fafb; border: 1px solid #e5e7eb; } .pill-red { color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; }

  .box { font-size: 12.5px; line-height: 1.5; padding: 9px 12px; border-radius: 9px; max-width: 360px; }
  .box-green { color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; } .box-amber { color: #92400e; background: #fffbeb; border: 1px solid #fde68a; } .box-red { color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; }

  .fld { display: block; width: 100%; max-width: 300px; } .fld-lbl { display: block; margin-bottom: 4px; font-size: 12px; font-weight: 500; color: #6b7280; } .fld-in { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; padding: 8px 11px; font-size: 13px; color: #111827; }

  .guide-now { width: 100%; max-width: 340px; border: 1px solid #ffe0d6; background: #fff7f4; border-radius: 10px; padding: 14px 16px; }
  .guide-prop { width: 100%; max-width: 340px; border: 1px solid var(--agent-border-subtle); background: #fff; border-radius: 12px; padding: 14px 16px; }

  .pgd { width: 100%; max-width: 360px; border: 1px solid var(--agent-border-subtle); border-radius: 16px; background: var(--agent-surface-elevated); padding: 18px 20px; }
  .pgd-h { margin: 0; font-size: 14.5px; font-weight: 700; color: var(--agent-text-primary); }
  .pgd-sub { margin: 5px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--agent-text-muted); }
  .pgd-div { height: 1px; background: var(--agent-border-subtle); margin: 15px 0; }
  .pgd-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 15px; }
  .pgd-sth { margin: 0; font-size: 13px; font-weight: 650; color: var(--agent-text-primary); }
  .pgd-stb { margin: 3px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--agent-text-muted); }
  .pgd-link { display: inline-flex; align-items: center; gap: 4px; margin-top: 7px; font-size: 12.5px; font-weight: 600; color: var(--agent-coral); text-decoration: none; transition: color 0.12s ease; }
  .pgd-link:hover { color: var(--agent-coral-deep); }
  .pgd-note { display: flex; align-items: flex-start; gap: 9px; margin-top: 16px; padding: 11px 13px; border-radius: 11px; background: var(--agent-surface-subtle); }
  .pgd-note span { font-size: 12px; line-height: 1.5; color: var(--agent-text-muted); }

  .glass-now { width: 100%; max-width: 320px; border-radius: 16px; padding: 16px 18px; background: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.7); box-shadow: 0 8px 30px rgba(15,23,42,0.08); backdrop-filter: blur(10px); }
  .glass-prop { width: 100%; max-width: 320px; border-radius: 12px; padding: 14px 16px; background: var(--agent-surface-subtle); border: 1px solid var(--agent-border-subtle); }

  .otp { display: flex; gap: 8px; } .otp-box { width: 38px; height: 46px; display: grid; place-items: center; font-size: 18px; font-weight: 700; border-radius: 10px; border: 2px solid rgba(15,23,42,0.12); color: #1a1d29; background: #fff; } .otp-blue { border-color: #2563eb; } .otp-coral { border-color: var(--agent-coral); color: var(--agent-text-primary); }

  .empty-now { width: 100%; max-width: 320px; text-align: center; border: 1px dashed rgba(0,0,0,0.14); border-radius: 11px; background: #fcfbfa; padding: 22px 16px; }
  .empty-prop { width: 100%; max-width: 320px; text-align: center; border: 1px solid var(--agent-border-subtle); border-radius: 12px; background: var(--agent-surface-subtle); padding: 22px 16px; }

  .cmp-sec { margin-top: 40px; border-top: 2px solid var(--agent-border-subtle); padding-top: 24px; }
  .cmp-sec h2 { font-size: 17px; font-weight: 760; margin: 0 0 4px; display: flex; align-items: center; gap: 10px; }
  .cmp-secsub { font-size: 13px; color: var(--agent-text-secondary); margin: 0 0 18px; }
  .gf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .gf-item { border: 1px solid var(--agent-border-default); border-radius: 14px; overflow: hidden; background: #fff; }
  .gf-render { padding: 22px; display: flex; justify-content: center; background: rgba(45,24,16,0.015); border-bottom: 1px solid var(--agent-border-subtle); }
  .gf-meta { padding: 13px 16px; display: flex; flex-direction: column; gap: 3px; } .gf-meta strong { font-size: 13px; font-weight: 700; color: var(--agent-text-primary); } .gf-meta span { font-size: 12px; line-height: 1.5; color: var(--agent-text-muted); }
  .tail { margin-top: 24px; font-size: 12.5px; line-height: 1.6; color: var(--agent-text-muted); border: 1px dashed var(--agent-border-default); border-radius: 12px; padding: 14px 16px; }

  @media (max-width: 760px) { .cmp-cols, .gf-grid { grid-template-columns: 1fr; } .cmp-col:first-child { border-right: 0; border-bottom: 1px solid var(--agent-border-subtle); } }
`;
