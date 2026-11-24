"use client";

// /dev/compare-email-templates
//
// Before/after review for the canonical pass on Account > Email templates.
// LEFT ("Now") reproduces the live component byte-for-byte using the real
// `etm-*` CSS. RIGHT ("Proposed") renders the actual canonical primitives.
// Plain-English explanation + any visual-risk flag under each card. Nothing
// here ships; it is a visual sign-off surface only.

import { useState } from "react";
import { Plus, Check, X, Buildings, User as UserIcon, LockSimple } from "@/components/icons/ph";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/ui/Badge";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LabelInput } from "@/components/ui/LabelInput";
import { SegmentedSwitch } from "@/components/ui/SegmentedSwitch";

const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

export default function CompareEmailTemplatesPage() {
  const [scope, setScope] = useState<"personal" | "company">("personal");
  const [vals, setVals] = useState({ name: "", description: "", subject: "" });

  return (
    <div className="cmp">
      <style>{CMP_CSS}</style>
      <style>{NOW_CSS}</style>

      <header className="cmp-hd">
        <h1>Email templates &mdash; canonical pass</h1>
        <p>
          Account &rsaquo; Email templates. Behaviour and breakpoints stay exactly as they are &mdash;
          this is a visual swap to the shared library parts, like we did on Profile, Team and Emails.
        </p>
        <div className="cmp-note">
          <strong>This page is already warm-toned.</strong> There are no grey-to-token colour changes to make here.
          The work is just swapping hand-built controls for the standard library ones, plus two small wording fixes.
        </div>
      </header>

      {/* 1 */}
      <Card
        n={1}
        title="The “Create template” button becomes the standard app button"
        blurb="The orange “Create template” button (and the matching one on the empty screen) is swapped for the app’s one standard primary button, so it presses and behaves like every other primary button."
        flag="Small shift: the current button has a subtle top-to-bottom orange gradient; the standard one is a single flat coral. This matches every other primary button in the app."
      >
        <Col label="Now">
          <button type="button" className="etm-create"><Plus size={15} weight="bold" /> Create template</button>
        </Col>
        <Col label="Proposed">
          <Button variant="primary" size="sm" style={coralVars}><Plus size={15} weight="bold" /> Create template</Button>
        </Col>
      </Card>

      {/* 2 */}
      <Card
        n={2}
        title="The “Company” / “Personal” tags become the standard bordered tag"
        blurb="Each template’s little “Company” or “Personal” label becomes the app’s standard outlined tag — the same tag style as Director / Negotiator on the Team page. The faint shaded fill behind “Company” goes away."
        flag="The standard tag is UPPERCASE (so “COMPANY” / “PERSONAL”) and has no shaded fill. I’ve kept the small icon. Tell me if you’d rather keep sentence-case or drop the icon."
      >
        <Col label="Now">
          <span className="etm-name">
            Exchange readiness
            <span className="etm-chip etm-chip-co"><Buildings size={11} weight="fill" /> Company</span>
          </span>
          <span className="etm-name" style={{ marginTop: 12 }}>
            Chase nudge
            <span className="etm-chip etm-chip-me"><UserIcon size={11} weight="fill" /> Personal</span>
          </span>
        </Col>
        <Col label="Proposed">
          <span className="etm-name">
            Exchange readiness
            <Badge tone="neutral"><Buildings size={11} weight="fill" style={{ marginRight: 4 }} /> Company</Badge>
          </span>
          <span className="etm-name" style={{ marginTop: 12 }}>
            Chase nudge
            <Badge tone="neutral"><UserIcon size={11} weight="fill" style={{ marginRight: 4 }} /> Personal</Badge>
          </span>
        </Col>
      </Card>

      {/* 3 */}
      <Card
        n={3}
        title="The “Only me / Whole company” picker becomes the standard sliding switch"
        blurb="In the editor, the two-button visibility picker becomes the app’s standard sliding switch — the chosen side fills with coral and its label turns white, and the pill slides across."
        flag="Biggest visible change on the page. Today the chosen side is a white box with a coral outline + coral text (a ring). The standard switch is a solid coral fill with white text, and the little person/building icons drop off. This is the same switch you approved on the Emails page."
      >
        <Col label="Now">
          <div className="etm-seg">
            <button type="button" className="etm-seg-b on"><UserIcon size={14} weight="bold" /> Only me</button>
            <button type="button" className="etm-seg-b"><Buildings size={14} weight="bold" /> Whole company</button>
          </div>
        </Col>
        <Col label="Proposed">
          <SegmentedSwitch
            options={[{ id: "personal", label: "Only me" }, { id: "company", label: "Whole company" }]}
            value={scope}
            onChange={setScope}
            size="sm"
            ariaLabel="Template visibility"
          />
        </Col>
      </Card>

      {/* 4 */}
      <Card
        n={4}
        title="The editor’s Cancel / Save / Remove buttons become standard buttons"
        blurb="The buttons at the bottom of the editor and the remove confirmation become the app’s standard buttons, with a proper spinner while saving. The red “Remove” becomes a lighter outlined red rather than a solid red block."
        flag="The red “Remove” button lightens from a solid red fill to the standard outlined red (same as everywhere else). Save keeps its coral and gains the standard spinner."
      >
        <Col label="Now">
          <div className="cmp-btnrow">
            <button type="button" className="etm-btn-ghost">Cancel</button>
            <button type="button" className="etm-btn-primary"><Check size={15} weight="bold" /> Save template</button>
          </div>
          <div className="cmp-btnrow" style={{ marginTop: 12 }}>
            <button type="button" className="etm-btn-ghost">Cancel</button>
            <button type="button" className="etm-btn-danger">Remove template</button>
          </div>
        </Col>
        <Col label="Proposed">
          <div className="cmp-btnrow">
            <Button variant="secondary" size="sm">Cancel</Button>
            <Button variant="primary" size="sm" style={coralVars}><Check size={15} weight="bold" /> Save template</Button>
          </div>
          <div className="cmp-btnrow" style={{ marginTop: 12 }}>
            <Button variant="secondary" size="sm">Cancel</Button>
            <Button variant="danger" size="sm">Remove template</Button>
          </div>
        </Col>
      </Card>

      {/* 5 */}
      <Card
        n={5}
        title="The editor’s close “X” becomes a standard icon button"
        blurb="The X that closes the editor becomes the app’s standard small square icon button."
        flag="The library rule technically pairs icon-only buttons with the red “danger” tone, but a red close-X would look wrong, so I’ve used the neutral ghost version. Say if you’d prefer otherwise."
      >
        <Col label="Now">
          <button type="button" className="etm-x" aria-label="Close"><X size={18} /></button>
        </Col>
        <Col label="Proposed">
          <Button variant="ghost" size="sm" icon aria-label="Close"><X size={18} /></Button>
        </Col>
      </Card>

      {/* 8 */}
      <Card
        n={8}
        title="The editor’s text boxes get the floating-label treatment"
        blurb="In the editor, “Template name”, “Description” and “Subject” get the app’s floating-label style: the label sits inside the empty box and lifts up as you type — the same fields as on Profile."
        flag="These fields have helpful example text today (“A short note so you remember when to use it”). The floating label replaces the placeholder, so I’ve re-homed that guidance as a small hint line under each box rather than losing it."
      >
        <Col label="Now">
          <label className="etm-field">
            <span className="etm-label">Template name<span className="etm-req"> *</span></span>
            <input className="etm-input" placeholder="e.g. Exchange readiness" readOnly />
          </label>
          <label className="etm-field" style={{ marginTop: 14 }}>
            <span className="etm-label">Description<span className="etm-hint"> (optional)</span></span>
            <input className="etm-input" placeholder="A short note so you remember when to use it" readOnly />
          </label>
        </Col>
        <Col label="Proposed">
          <LabelInput field="Template name" label="Template name" required fullWidth accent="#FF6B4A"
            value={vals.name} onChange={(e) => setVals((v) => ({ ...v, name: e.target.value }))} />
          <div style={{ marginTop: 14 }}>
            <LabelInput field="Description" label="Description" fullWidth accent="#FF6B4A"
              value={vals.description} onChange={(e) => setVals((v) => ({ ...v, description: e.target.value }))} />
            <span className="cmp-hint">A short note so you remember when to use it.</span>
          </div>
        </Col>
      </Card>

      {/* 9 */}
      <Card
        n={9}
        title="The “variables not set” note becomes the standard inline warning"
        blurb="The small amber “2 variables not set on this file” line under the preview becomes the app’s standard bordered warning strip (with the little alert icon)."
        flag="This is a quiet caption today. As a standard warning strip it reads a touch more prominent. Tell me if you’d rather it stayed a faint caption."
      >
        <Col label="Now">
          <div className="etm-prev-missing">2 variables not set on this file.</div>
        </Col>
        <Col label="Proposed">
          <InlineAlert kind="warning">2 variables not set on this file.</InlineAlert>
        </Col>
      </Card>

      {/* 10 */}
      <Card
        n={10}
        title="Two small wording fixes"
        blurb="House-style corrections to match the voice rules we use everywhere else."
      >
        <Col label="Now">
          <p className="cmp-copy"><span className="cmp-bad">Delete template</span> <span className="cmp-sub">(row menu)</span></p>
          <p className="cmp-copy"><span className="cmp-bad">Your sign-off &amp; signature &mdash; added automatically</span></p>
        </Col>
        <Col label="Proposed">
          <p className="cmp-copy"><span className="cmp-good">Remove template</span> <span className="cmp-sub">(matches the “Remove” used everywhere else in this flow)</span></p>
          <p className="cmp-copy"><span className="cmp-good">Your sign-off and signature, added for you</span> <span className="cmp-sub">(no dash, no “automatically”)</span></p>
        </Col>
      </Card>

      {/* Grandfather */}
      <section className="cmp-gf">
        <h2>Staying exactly as-is (no change)</h2>
        <ul>
          <li><strong>The bold / italic / link toolbar</strong> in the message editor — it uses a special trick to keep your text selected while you format, and it deliberately matches the main email composer. Changing it alone would risk breaking formatting and split the two editors.</li>
          <li><strong>The “Pick a file…” preview chooser</strong> — a live search dropdown with its own behaviour; not worth the risk to restyle in a visual pass.</li>
          <li><strong>The template list / table</strong> — it has a “Last updated” column and a header row that the standard row component can’t carry without losing information. Its row menu already uses the standard component.</li>
        </ul>
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

const CMP_CSS = `
  /* This is a bare /dev route (no AgentShell), so define the agent tokens the
     canonical primitives read — otherwise SegmentedSwitch's coral pill (which
     has no hex fallback) is invisible and looks dead. */
  .cmp {
    --agent-coral: #FF6B4A; --agent-coral-deep: #E2452A; --agent-coral-rgb: 255,107,74;
    --agent-text-on-coral: #ffffff;
    --agent-text-primary: #2D1810; --agent-text-secondary: #5A3A28; --agent-text-muted: #9a8a7f; --agent-text-tertiary: #7A4A2E;
    --agent-border-default: rgba(20,16,10,0.14); --agent-border-subtle: rgba(20,16,10,0.08);
    --agent-hover-shade: rgba(45,24,16,0.05); --agent-hover-shade-strong: rgba(45,24,16,0.08);
    --agent-surface-elevated: #ffffff; --agent-radius-md: 10px; --agent-radius-sm: 8px;
    max-width: 1000px; margin: 0 auto; padding: 40px 28px 120px; color: var(--agent-text-primary, #2D1810);
  }
  .cmp-hd h1 { font-size: 26px; font-weight: 800; margin: 0 0 8px; }
  .cmp-hd > p { font-size: 14px; line-height: 1.6; color: var(--agent-text-secondary, #5A3A28); max-width: 680px; margin: 0 0 16px; }
  .cmp-note { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary, #5A3A28); background: var(--agent-hover-shade, rgba(45,24,16,0.05)); border: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); border-radius: 12px; padding: 12px 15px; }
  .cmp-note strong { color: var(--agent-text-primary, #2D1810); }

  .cmp-card { margin-top: 30px; border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 16px; overflow: hidden; background: #fff; }
  .cmp-card-hd { display: flex; gap: 13px; padding: 18px 20px; border-bottom: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); }
  .cmp-n { flex: 0 0 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: var(--agent-coral-deep, #E2452A); color: #fff; font-size: 13px; font-weight: 800; }
  .cmp-card-hd h3 { font-size: 15.5px; font-weight: 720; margin: 1px 0 5px; }
  .cmp-card-hd > div > p { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary, #5A3A28); margin: 0; max-width: 760px; }
  .cmp-flag { margin-top: 8px !important; font-size: 12.5px !important; color: var(--agent-text-tertiary, #7A4A2E) !important; background: rgba(201,125,26,0.08); border-radius: 8px; padding: 8px 11px; }

  .cmp-cols { display: grid; grid-template-columns: 1fr 1fr; }
  .cmp-col { padding: 22px; min-width: 0; }
  .cmp-col:first-child { border-right: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); background: var(--agent-hover-shade, rgba(45,24,16,0.025)); }
  .cmp-col-lbl { display: block; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--agent-text-muted, #9a8a7f); margin-bottom: 14px; }
  .cmp-col-body { display: flex; flex-direction: column; align-items: flex-start; }

  .cmp-btnrow { display: flex; gap: 10px; align-items: center; }
  .cmp-hint { display: block; margin-top: 5px; font-size: 11.5px; color: var(--agent-text-muted, #9a8a7f); }
  .cmp-copy { font-size: 14px; margin: 0 0 10px; }
  .cmp-sub { font-size: 12px; color: var(--agent-text-muted, #9a8a7f); }
  .cmp-bad { text-decoration: line-through; color: var(--agent-text-muted, #9a8a7f); }
  .cmp-good { font-weight: 650; color: var(--agent-text-primary, #2D1810); }

  .cmp-gf { margin-top: 34px; border: 1px dashed var(--agent-border-default, rgba(20,16,10,0.16)); border-radius: 14px; padding: 20px 22px; }
  .cmp-gf h2 { font-size: 15px; font-weight: 720; margin: 0 0 12px; }
  .cmp-gf ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 9px; }
  .cmp-gf li { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary, #5A3A28); }
  .cmp-gf strong { color: var(--agent-text-primary, #2D1810); }

  @media (max-width: 760px) { .cmp-cols { grid-template-columns: 1fr; } .cmp-col:first-child { border-right: 0; border-bottom: 1px solid var(--agent-border-subtle); } }
`;

// Byte-for-byte copy of the live component CSS used by the "Now" column.
const NOW_CSS = `
  .etm-create { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 650; color: #fff; background: var(--agent-btn-bg, linear-gradient(180deg,#FF8A65,#E2452A)); border: 0; border-radius: 11px; padding: 10px 15px; cursor: pointer; box-shadow: var(--agent-btn-shadow, 0 4px 14px rgba(226,69,42,0.26)); white-space: nowrap; }
  .etm-name { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 650; color: var(--agent-text-primary, #2D1810); }
  .etm-chip { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.1)); }
  .etm-chip-co { color: var(--agent-text-secondary, #5A3A28); background: var(--agent-hover-shade-strong, rgba(45,24,16,0.08)); }
  .etm-chip-me { color: var(--agent-text-muted, #9a8a7f); background: transparent; }
  .etm-seg { display: inline-flex; gap: 5px; background: var(--agent-hover-shade, rgba(45,24,16,0.05)); padding: 4px; border-radius: 11px; }
  .etm-seg-b { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--agent-text-secondary, #5A3A28); background: none; border: 1px solid transparent; border-radius: 8px; padding: 7px 13px; cursor: pointer; transition: all .14s; }
  .etm-seg-b.on { background: #fff; border-color: var(--agent-coral-deep, #E2452A); color: var(--agent-coral-deep, #E2452A); box-shadow: 0 1px 4px rgba(20,14,10,0.08); }
  .etm-x { width: 30px; height: 30px; display: grid; place-items: center; border: 0; background: none; border-radius: 8px; color: var(--agent-text-muted); cursor: pointer; }
  .etm-x:hover { background: var(--agent-hover-shade); }
  .etm-field { display: block; width: 100%; max-width: 340px; }
  .etm-label { display: block; font-size: 12px; font-weight: 700; color: var(--agent-text-secondary, #5A3A28); margin-bottom: 6px; }
  .etm-req { color: var(--agent-coral-deep, #E2452A); }
  .etm-hint { font-weight: 500; color: var(--agent-text-muted, #9a8a7f); }
  .etm-input { width: 100%; box-sizing: border-box; font-size: 14px; padding: 10px 12px; border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 10px; color: var(--agent-text-primary, #2D1810); outline: none; background: #fff; }
  .etm-btn-ghost { font-size: 13.5px; font-weight: 600; color: var(--agent-text-secondary, #5A3A28); background: none; border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 10px; padding: 9px 16px; cursor: pointer; }
  .etm-btn-primary { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 650; color: #fff; background: var(--agent-btn-bg, linear-gradient(180deg,#FF8A65,#E2452A)); border: 0; border-radius: 10px; padding: 9px 18px; cursor: pointer; box-shadow: var(--agent-btn-shadow, 0 4px 14px rgba(226,69,42,0.26)); }
  .etm-btn-danger { display: inline-flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 650; color: #fff; background: #C0392B; border: 0; border-radius: 10px; padding: 9px 16px; cursor: pointer; }
  .etm-prev-missing { font-size: 12px; color: #B45309; }
`;
