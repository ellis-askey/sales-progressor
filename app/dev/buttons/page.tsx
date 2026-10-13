"use client";

// /dev/buttons — the button census. Every distinct button LOOK found across the
// agent / internal (TSP) side of the app, each with a working specimen, a given
// name, its source, and where it's used — so the variety can be reviewed and
// reduced (founder ask, 2026-10-13).
//
// Specimens use the REAL class wherever the CSS is importable (agent-system,
// claim-flow, welcome-steps). Styles that live inside a component's own
// <style> block (Log an update, compose, login, chase drawers) are recreated
// faithfully inline, with the source file named so the original is one click
// away. Dev-only: blocked in production.

import { notFound } from "next/navigation";
import { WELCOME_STEPS_CSS } from "@/components/agent/welcome-steps-styles";
import { ArrowRight, PaperPlaneTilt, Sparkle, CaretDown, X, Plus, Play } from "@phosphor-icons/react";
import { GoogleIcon } from "@/components/login/GoogleIcon";

type Specimen = {
  name: string;
  source: string;
  sightings: string;
  fold?: string; // suggested fold target for the reduction exercise
  render: () => React.ReactNode;
};

type Family = { title: string; blurb: string; specimens: Specimen[] };

// ── Inline recreations of component-embedded styles (source noted per row) ────

const POP_GRADIENT = "linear-gradient(180deg, #FF6F4E 0%, #F04E2C 100%)";
const POP_SHADOW = "0 2px 0 #C63E20, 0 6px 16px rgba(240,78,44,0.30), inset 0 1px 0 rgba(255,255,255,0.3)";

const FAMILIES: Family[] = [
  {
    title: "Canonical system (components/ui/Button)",
    blurb: "The typed primitive and its agent-btn classes. This is the family everything else should fold towards.",
    specimens: [
      {
        name: "System Primary",
        source: "agent-system.css · .agent-btn-primary",
        sightings: "Hub, file pages, most modals and drawers via <Button>",
        render: () => <button className="agent-btn agent-btn-md agent-btn-primary">Save changes</button>,
      },
      {
        name: "System Secondary",
        source: "agent-system.css · .agent-btn-secondary",
        sightings: "Paired actions beside a primary",
        render: () => <button className="agent-btn agent-btn-md agent-btn-secondary">View timeline</button>,
      },
      {
        name: "System Ghost",
        source: "agent-system.css · .agent-btn-ghost",
        sightings: "Tertiary actions, inline affordances",
        render: () => <button className="agent-btn agent-btn-md agent-btn-ghost">Dismiss</button>,
      },
      {
        name: "System Neutral",
        source: "agent-system.css · .agent-btn-neutral",
        sightings: "Modal footers (Cancel)",
        render: () => <button className="agent-btn agent-btn-md agent-btn-neutral">Cancel</button>,
      },
      {
        name: "System Danger",
        source: "agent-system.css · .agent-btn-danger",
        sightings: "Destructive confirms (withdraw, remove)",
        render: () => <button className="agent-btn agent-btn-md agent-btn-danger">Remove file</button>,
      },
      {
        name: "Cascade-proof Primary",
        source: "agent-system.css · .agent-btn-color-primary",
        sightings: "Modals where Tailwind cascade pollutes .agent-btn-primary — same look, escape hatch",
        fold: "Keep (technical twin of System Primary)",
        render: () => <button className="agent-btn agent-btn-md agent-btn-color-primary">Confirm</button>,
      },
      {
        name: "Icon Button",
        source: "agent-system.css · .agent-icon-btn / -sm",
        sightings: "Close crosses, header chrome, row actions",
        render: () => (
          <span style={{ display: "inline-flex", gap: 10 }}>
            <button className="agent-icon-btn" aria-label="Close"><X size={16} weight="bold" /></button>
            <button className="agent-icon-btn agent-icon-btn-sm" aria-label="Close"><X size={13} weight="bold" /></button>
          </span>
        ),
      },
      {
        name: "Size scale (xs / sm / md / lg)",
        source: "agent-system.css · .agent-btn-xs…lg",
        sightings: "All system buttons",
        render: () => (
          <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="agent-btn agent-btn-xs agent-btn-primary">xs</button>
            <button className="agent-btn agent-btn-sm agent-btn-primary">sm</button>
            <button className="agent-btn agent-btn-md agent-btn-primary">md</button>
            <button className="agent-btn agent-btn-lg agent-btn-primary">lg</button>
          </span>
        ),
      },
    ],
  },
  {
    title: "Gradient primaries (hand-rolled)",
    blurb: "Seven different coral primaries living outside the system. The reduction opportunity is mostly here.",
    specimens: [
      {
        name: "Pop Primary (vertical + underledge)",
        source: "LogUpdateModal.tsx CSS (.lum-trigger/.lum-primary) + inline in ClaimWelcomeModal",
        sightings: "Log an update trigger + CTAs, chain-welcome Set up, selected option chips",
        fold: "Candidate NEW standard — it's the look you've been applying everywhere this week",
        render: () => (
          <button style={{ display: "inline-flex", alignItems: "center", gap: 9, font: "inherit", fontSize: 14, fontWeight: 600, color: "#fff", border: 0, cursor: "pointer", padding: "11px 18px", borderRadius: 12, background: POP_GRADIENT, boxShadow: POP_SHADOW }}>
            Log an update
          </button>
        ),
      },
      {
        name: "Welcome CTA",
        source: "welcome-steps-styles.ts · .pw-cta",
        sightings: "Welcome modals (director, progressor, claim variant)",
        fold: "≈ Pop Primary at larger radius — fold?",
        render: () => (
          <span className="pw-scope"><button className="pw-cta">Next: Choose your chases <ArrowRight size={18} weight="bold" /></button></span>
        ),
      },
      {
        name: "Glossy Key",
        source: "claim-flow.css · .claim-btn",
        sightings: "Claim landing/signup/login CTAs (Join this chain, Create account)",
        fold: "Marketing-facing — keep for claim flow only?",
        render: () => (
          <span className="rec-scope" style={{ display: "inline-block", minWidth: 280 }}>
            <button className="claim-btn" style={{ padding: "14px 24px" }}>Create account &amp; join chain</button>
          </span>
        ),
      },
      {
        name: "Chase Split Button",
        source: "agent-system.css · .rem-chase (ChaseSplitButton)",
        sightings: "Reminders deck",
        fold: "≈ Pop Primary with a caret — fold the base look?",
        render: () => (
          <span className="rem-chase" style={{ display: "inline-flex" }}>
            <button className="rem-chase-go" style={{ border: 0, cursor: "pointer", color: "#fff", font: "inherit", fontSize: 13, fontWeight: 700, padding: "10px 16px", borderRadius: "11px 0 0 11px" }}>Chase</button>
            <button className="rem-chase-caret" style={{ border: 0, cursor: "pointer", color: "#fff", padding: "0 10px", borderRadius: "0 11px 11px 0" }} aria-label="More"><CaretDown size={13} weight="bold" /></button>
          </span>
        ),
      },
      {
        name: "Reconcile Strip CTA",
        source: "claim-flow.css · .rec-prompt-cta",
        sightings: "Where's-this-sale-up-to strip (Update progress)",
        fold: "≈ Pop Primary small — fold",
        render: () => (
          <span className="rec-scope"><button className="rec-prompt-cta" style={{ border: 0, cursor: "pointer", color: "#fff", font: "inherit", fontSize: 13, fontWeight: 700, padding: "10px 16px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 8 }}>Update progress <ArrowRight size={14} weight="bold" /></button></span>
        ),
      },
      {
        name: "Flat Login Primary",
        source: "WarmLoginForm.tsx / RegisterForm.tsx inline (.wbtn)",
        sightings: "Main login, register, forgot/reset password",
        fold: "Flat coral, no gradient — fold into Pop or System?",
        render: () => (
          <button style={{ minWidth: 220, padding: 12, borderRadius: 8, background: "#FF6B4A", color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(255,107,74,0.35)", font: "inherit" }}>Sign in</button>
        ),
      },
      {
        name: "Compose Send (squared split)",
        source: "ComposeEmailModal.tsx CSS (.cem-send-go / .cem-send-split)",
        sightings: "Compose email footer",
        fold: "Diagonal gradient, square corners — unify with Chase Split?",
        render: () => (
          <span style={{ display: "inline-flex", borderRadius: 10, overflow: "hidden" }}>
            <button style={{ border: "none", cursor: "pointer", color: "#fff", font: "inherit", fontSize: 14, fontWeight: 650, padding: "0 18px", height: 40, display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, var(--agent-coral-deep, #FF6B4A), var(--agent-coral-light, #FFB18F))" }}><PaperPlaneTilt size={15} weight="fill" /> Send</button>
            <button style={{ border: "none", cursor: "pointer", color: "#fff", width: 34, height: 40, display: "grid", placeItems: "center", background: "linear-gradient(135deg, var(--agent-coral-darker, #E55B3D), var(--agent-coral-deep, #FF6B4A))", boxShadow: "inset 1px 0 0 rgba(255,255,255,0.18)" }} aria-label="Send options"><CaretDown size={12} weight="bold" /></button>
          </span>
        ),
      },
      {
        name: "Compose Refine Chip",
        source: "ComposeEmailModal.tsx CSS (.cem-refine)",
        sightings: "Compose email AI refine",
        fold: "Small vertical gradient chip — fold into System xs/sm",
        render: () => (
          <button style={{ display: "inline-flex", alignItems: "center", height: 30, padding: "0 12px", gap: 6, fontSize: 12, fontWeight: 650, color: "#fff", border: "1px solid transparent", borderRadius: 8, cursor: "pointer", font: "inherit", background: "linear-gradient(180deg, var(--agent-coral, #FF8A65) 0%, var(--agent-coral-deep, #FF6B4A) 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 4px rgba(224,78,44,0.26)" }}><Sparkle size={13} weight="fill" /> Refine</button>
        ),
      },
      {
        name: "Drawer Inline Primary",
        source: "hand-rolled inline styles in ChaseDrawer / ChaseNeighbourDrawer / EnquiryChaseDrawer",
        sightings: "Generate message, Send chase, Save & continue in chase/enquiry drawers",
        fold: "Visually ≈ System Primary — should BE <Button>",
        render: () => (
          <button style={{ minWidth: 220, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, color: "white", border: "none", cursor: "pointer", background: "linear-gradient(135deg, var(--agent-coral-deep, #FF6B4A), var(--agent-coral-light, #FFB18F))", boxShadow: "0 4px 20px rgba(255,107,74,0.32)", font: "inherit" }}><Sparkle size={15} weight="fill" /> Generate message</button>
        ),
      },
      {
        name: "Marketing Diagonal",
        source: "inline in NotFoundView / AgentInstallPrompt / SurveyForm",
        sightings: "404 view CTA, PWA install prompt, feedback survey",
        fold: "≈ System Primary with lighter stops — fold",
        render: () => (
          <button style={{ padding: "11px 20px", borderRadius: 12, border: "none", cursor: "pointer", color: "#fff", fontSize: 14, fontWeight: 650, font: "inherit", background: "linear-gradient(135deg, #FF8A65, #FF6B4A)", boxShadow: "0 6px 18px -6px rgba(255,107,74,0.5)" }}>Install the app</button>
        ),
      },
    ],
  },
  {
    title: "Quiet secondaries, ghosts and outlines",
    blurb: "The low-emphasis half of the pairings.",
    specimens: [
      {
        name: "Welcome Ghost",
        source: "welcome-steps-styles.ts · .pw-ghost",
        sightings: "Skip for now, Take a quick tour",
        fold: "≈ System Ghost — fold",
        render: () => <span className="pw-scope"><button className="pw-ghost"><Play size={15} weight="fill" /> Take a quick tour</button></span>,
      },
      {
        name: "Welcome Back Link",
        source: "welcome-steps-styles.ts · .pw-back",
        sightings: "Back between welcome steps",
        render: () => <span className="pw-scope"><button className="pw-back">← Back</button></span>,
      },
      {
        name: "Coral Outline Secondary",
        source: "welcome-steps-styles.ts · .pw-secondary",
        sightings: "Welcome modals' alternative action",
        fold: "≈ Claim Ghost — pick one outline",
        render: () => <span className="pw-scope"><button className="pw-secondary"><Plus size={16} weight="bold" /> Add a sale</button></span>,
      },
      {
        name: "Claim Ghost (outline)",
        source: "claim-flow.css · .claim-btn--ghost",
        sightings: "Claim flow secondary actions",
        fold: "≈ Coral Outline Secondary — pick one outline",
        render: () => <span className="rec-scope"><button className="claim-btn claim-btn--ghost" style={{ padding: "12px 22px", display: "inline-block", width: "auto" }}>Link an existing file</button></span>,
      },
      {
        name: "OAuth White",
        source: "claim-flow.css · .claim-oauth-btn (twin: inline .woauth in WarmLoginForm)",
        sightings: "Main login + claim login SSO",
        fold: "Two copies of the same look — share one class",
        render: () => <span className="rec-scope" style={{ display: "inline-block", minWidth: 240 }}><button className="claim-oauth-btn" style={{ width: "100%" }}><GoogleIcon /> Continue with Google</button></span>,
      },
    ],
  },
  {
    title: "Link buttons",
    blurb: "Text-only actions.",
    specimens: [
      {
        name: "Muted Link",
        source: "agent-system.css · .agent-link-muted",
        sightings: "OK / dismiss affordances in notices",
        render: () => <button className="agent-link-muted" style={{ background: "none", border: "none", cursor: "pointer", font: "inherit", fontSize: 13 }}>Not now</button>,
      },
      {
        name: "Coral Link + slide-in arrow",
        source: "claim-flow.css · .claim-login-link",
        sightings: "Log in instead (claim signup)",
        render: () => <span className="rec-scope" style={{ fontSize: 13 }}><a className="claim-login-link" href="#specimen" style={{ color: "var(--claim-coral, #FF6B4A)", textDecoration: "none", fontWeight: 600 }}>Log in instead</a></span>,
      },
      {
        name: "Chain Fold Toggle",
        source: "claim-flow.css · .claim-chain-toggle",
        sightings: "Show/hide the other sales (claim signup)",
        fold: "≈ Coral Link — fold",
        render: () => <span className="rec-scope"><button className="claim-chain-toggle">Show the 3 other sales in this chain</button></span>,
      },
    ],
  },
  {
    title: "Selected-option cards (this week's standard)",
    blurb: "Not action buttons, but they share the Pop gradient when selected — included so the family reads together.",
    specimens: [
      {
        name: "Option Card — selected (Pop gradient)",
        source: "claim-flow.css · .claim-choice-card.on (same treatment: survey level picker, log-update side chips)",
        sightings: "Tenure/purchase pickers, survey level, log-update audience",
        render: () => (
          <span className="rec-scope" style={{ display: "inline-flex", gap: 10 }}>
            <button className="claim-choice-card on" style={{ width: 150 }}><span className="claim-choice-label" style={{ color: "#fff" }}>Freehold</span></button>
            <button className="claim-choice-card" style={{ width: 150 }}><span className="claim-choice-label">Leasehold</span></button>
          </span>
        ),
      },
    ],
  },
];

const PW_SCOPE_CSS = `
.pw-scope { --coral:#FF6B4A; --coral-tint:rgba(255,138,101,0.12); --cta-from:#FF8365; --cta-to:#F04E2C;
  --cta-shadow:rgba(240,78,44,0.32); --cta-shadow-hi:rgba(240,78,44,0.42); --muted:rgba(45,24,16,0.55);
  --body:#5A3A28; --heading:#2D1810; --surface:#ffffff; --row-border:rgba(45,24,16,0.10); display:inline-block; }
`;

export default function DevButtonsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const total = FAMILIES.reduce((n, f) => n + f.specimens.length, 0);

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "48px 28px 90px", fontFamily: "var(--font-geist-sans, system-ui)" }}>
      <style>{WELCOME_STEPS_CSS}</style>
      <style>{PW_SCOPE_CSS}</style>

      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--agent-coral-deep, #E8542F)" }}>Dev · design review</p>
      <h1 style={{ margin: "8px 0 6px", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--agent-text-primary, #2D1810)" }}>The button census</h1>
      <p style={{ margin: "0 0 8px", fontSize: 14.5, color: "var(--agent-text-secondary, #5A3A28)", maxWidth: 640, lineHeight: 1.55 }}>
        Every distinct button look on the agent / internal side, named and placed. {total} specimens across {FAMILIES.length} families.
        Where a specimen can&apos;t import its CSS (it lives inside a component), the look is recreated faithfully and the source named.
        The &ldquo;fold&rdquo; notes are starting suggestions for the reduction, nothing more.
      </p>

      {FAMILIES.map((fam) => (
        <section key={fam.title} style={{ marginTop: 40 }}>
          <h2 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 750, color: "var(--agent-text-primary, #2D1810)" }}>{fam.title}</h2>
          <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--agent-text-muted, rgba(45,24,16,0.55))" }}>{fam.blurb}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {fam.specimens.map((s) => (
              <div
                key={s.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(260px, 340px) 1fr",
                  gap: 20,
                  alignItems: "center",
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.78)",
                  border: "0.5px solid rgba(45,24,16,0.10)",
                  boxShadow: "0 2px 10px rgba(45,24,16,0.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", minHeight: 48 }}>{s.render()}</div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary, #2D1810)" }}>{s.name}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-secondary, #5A3A28)" }}>{s.sightings}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 11, fontFamily: "ui-monospace, monospace", color: "var(--agent-text-muted, rgba(45,24,16,0.55))", overflowWrap: "anywhere" }}>{s.source}</p>
                  {s.fold && (
                    <p style={{ margin: "5px 0 0", fontSize: 11.5, fontWeight: 600, color: "var(--agent-coral-deep, #E8542F)" }}>Fold: {s.fold}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
