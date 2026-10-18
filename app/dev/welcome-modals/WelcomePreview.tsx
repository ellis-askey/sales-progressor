"use client";

// Opens the REAL welcome components with seeded props, so what you see is exactly
// what each role gets in the app:
//   • director / negotiator        → <WelcomeModal> (self-managed OR progressor-managed)
//   • external progression OWNER   → <ProgressorWelcomeModal>
//   • external progression TEAM    → nothing today (the resolver returns null for
//                                     non-owners), shown here as an explicit note.
// A faux 232px sidebar + 44px topbar reproduce the agent shell so the modals
// centre exactly as they do in-app (the welcome overlay pads past that chrome).

import { useState, useEffect } from "react";
// Sandbox copies — iterate on these; the real components stay frozen until wire-up.
import { AgentWelcomePreview } from "./_preview/AgentWelcomePreview";
import { SelfProgWelcomePreview } from "./_preview/SelfProgWelcomePreview";
import { ProgressorWelcomePreview } from "./_preview/ProgressorWelcomePreview";

type Variant = "agent-self" | "agent-prog" | "prog-owner" | "prog-team";

// Seeded sample data (not real customers) — the components take props directly,
// so no DB seeding is needed.
const SAMPLE_BUSINESS = "Harbour & Co Progression";
const SAMPLE_AGENT = "Jordan Blake";
const SAMPLE_OWNER = "Sarah Hughes";
const SAMPLE_PREFS = { client: true, solicitor: true, enquiries: true, weekly: true, chain: true };

const OPTIONS: Array<{ key: Variant; who: string; title: string; desc: string; hasModal: boolean }> = [
  { key: "agent-self",  who: "Director / negotiator", title: "Agent welcome — self-managed agency (NEW 3-step)", desc: "An agency that manages its own sales. New flow: what it does, choose your chases, add your first sale.", hasModal: true },
  { key: "agent-prog",  who: "Director / negotiator", title: "Agent welcome — progressor-managed agency", desc: "An agency whose sales are progressed by an external business. The progressor-managed copy variant.", hasModal: true },
  { key: "prog-owner",  who: "Progression business owner", title: "Progressor welcome — owner", desc: "The 3-step owner welcome: what it does, choose your chases, add your first client.", hasModal: true },
  { key: "prog-team",   who: "Progression team member", title: "Progressor welcome — team member", desc: "A non-owner member. No welcome is shown today (the resolver returns null for non-owners).", hasModal: false },
];

export function WelcomePreview() {
  const [variant, setVariant] = useState<Variant | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [dark, setDark] = useState(false);

  // useDarkMode reads document.documentElement.dataset.theme live, so this drives
  // the progressor modal's light/dark + the frame tokens.
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  function open(v: Variant, hasModal: boolean) {
    setVariant(v);
    if (hasModal) setRenderKey((k) => k + 1); // force a fresh mount so re-opening replays
  }

  return (
    <>
      {/* Faux agent shell chrome so the modal centres exactly as in-app */}
      <div aria-hidden className="wp-side">
        <div className="wp-logo">Harbour<span>.</span></div>
        <div className="wp-navgroup">
          {["Hub", "All files", "Updates", "Reminders", "Clients"].map((n) => (
            <div key={n} className="wp-navrow"><span className="wp-navdot" />{n}</div>
          ))}
        </div>
      </div>
      <div aria-hidden className="wp-top" />

      {/* Picker — lives in the content area (right of the faux sidebar) */}
      <div className="wp-stage">
        <div className="wp-panel">
          <div className="wp-panel-hd">
            <div>
              <p className="wp-kicker">Dev preview</p>
              <h1 className="wp-h1">Welcome modals</h1>
              <p className="wp-sub">The real components, exactly as each role sees them. Pick one to open it.</p>
            </div>
            <div className="wp-seg" role="group" aria-label="Theme">
              <button className={!dark ? "on" : ""} onClick={() => setDark(false)}>Light</button>
              <button className={dark ? "on" : ""} onClick={() => setDark(true)}>Dark</button>
            </div>
          </div>

          <div className="wp-opts">
            {OPTIONS.map((o) => (
              <button
                key={o.key}
                className={`wp-opt${variant === o.key ? " active" : ""}${o.hasModal ? "" : " note"}`}
                onClick={() => open(o.key, o.hasModal)}
              >
                <span className="wp-opt-who">{o.who}</span>
                <span className="wp-opt-title">{o.title}</span>
                <span className="wp-opt-desc">{o.desc}</span>
                {!o.hasModal && <span className="wp-opt-tag">No modal today</span>}
              </button>
            ))}
          </div>

          <p className="wp-foot">
            Sample names are placeholders. The agent welcome is intentionally light-only, so the Dark toggle
            only changes the progressor welcome (and this frame). Clicking a primary CTA inside a modal
            navigates, exactly as it does in the app.
          </p>
        </div>
      </div>

      {/* Sandbox copies of the real modals */}
      {variant === "agent-self" && (
        <SelfProgWelcomePreview key={renderKey} userName={SAMPLE_AGENT} initialPrefs={SAMPLE_PREFS} themeMode={dark ? "dark" : "light"} />
      )}
      {variant === "agent-prog" && (
        <AgentWelcomePreview key={renderKey} agencyModeProfile="progressor_managed" userName={SAMPLE_AGENT} progressorName={SAMPLE_BUSINESS} />
      )}
      {variant === "prog-owner" && (
        <ProgressorWelcomePreview
          key={renderKey}
          businessName={SAMPLE_BUSINESS}
          userName={SAMPLE_OWNER}
          initialPrefs={SAMPLE_PREFS}
          themeMode={dark ? "dark" : "light"}
        />
      )}

      <style>{WP_CSS}</style>
    </>
  );
}

const WP_CSS = `
  .wp-side { position: fixed; top: 0; left: 0; bottom: 0; width: 232px; z-index: 5;
    background: var(--agent-surface-glass, rgba(255,255,255,0.6)); border-right: 1px solid var(--agent-border-subtle);
    backdrop-filter: blur(20px); padding: 16px 14px; display: flex; flex-direction: column; gap: 22px; }
  .wp-logo { font-size: 17px; font-weight: 800; letter-spacing: -0.5px; color: var(--agent-text-primary); padding: 6px 8px; }
  .wp-logo span { color: var(--agent-coral, #FF6B4A); }
  .wp-navgroup { display: flex; flex-direction: column; gap: 3px; }
  .wp-navrow { display: flex; align-items: center; gap: 11px; padding: 9px 10px; border-radius: 9px; font-size: 13px;
    font-weight: 500; color: var(--agent-text-secondary); }
  .wp-navdot { width: 7px; height: 7px; border-radius: 999px; background: var(--agent-border-strong, rgba(45,24,16,0.2)); }
  .wp-top { position: fixed; top: 0; left: 232px; right: 0; height: 44px; z-index: 5;
    background: var(--agent-surface-glass, rgba(255,255,255,0.6)); border-bottom: 1px solid var(--agent-border-subtle);
    backdrop-filter: blur(20px); }
  @media (max-width: 767px) { .wp-side, .wp-top { display: none; } }

  .wp-stage { position: relative; z-index: 1; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 72px 24px 32px; padding-left: calc(232px + 24px); }
  @media (max-width: 767px) { .wp-stage { padding-left: 24px; padding-top: 32px; } }

  .wp-panel { width: 100%; max-width: 620px; background: var(--agent-surface-elevated, #fff);
    border: 0.5px solid var(--agent-border-default); border-radius: 18px;
    box-shadow: 0 24px 64px rgba(var(--agent-shadow-rgb, 45,24,16), 0.14), 0 4px 16px rgba(var(--agent-shadow-rgb, 45,24,16), 0.06);
    padding: 24px; }
  .wp-panel-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
  .wp-kicker { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--agent-coral, #FF6B4A); }
  .wp-h1 { margin: 6px 0 0; font-size: 22px; font-weight: 800; letter-spacing: -0.4px; color: var(--agent-text-primary); }
  .wp-sub { margin: 6px 0 0; font-size: 13.5px; line-height: 1.5; color: var(--agent-text-muted); }

  .wp-seg { display: inline-flex; flex-shrink: 0; background: var(--agent-hover-shade, rgba(45,24,16,0.05)); border: 1px solid var(--agent-border-subtle);
    border-radius: 999px; padding: 2px; }
  .wp-seg button { appearance: none; border: 0; background: transparent; cursor: pointer; font: inherit; font-size: 12px;
    font-weight: 600; color: var(--agent-text-muted); padding: 5px 13px; border-radius: 999px; transition: all 140ms ease; }
  .wp-seg button.on { background: var(--agent-coral, #FF6B4A); color: #fff; }

  .wp-opts { display: flex; flex-direction: column; gap: 10px; }
  .wp-opt { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; cursor: pointer;
    padding: 14px 16px; border-radius: 13px; background: var(--agent-surface-elevated, #fff);
    border: 0.5px solid var(--agent-border-default); transition: border-color 140ms ease, transform 120ms ease, box-shadow 140ms ease; }
  .wp-opt:hover { border-color: var(--agent-coral, #FF6B4A); transform: translateY(-1px); box-shadow: 0 8px 20px rgba(var(--agent-shadow-rgb, 45,24,16), 0.08); }
  .wp-opt.active { border-color: var(--agent-coral, #FF6B4A); }
  .wp-opt.note { cursor: default; }
  .wp-opt.note:hover { transform: none; box-shadow: none; border-color: var(--agent-border-default); }
  .wp-opt-who { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--agent-coral, #FF6B4A); }
  .wp-opt-title { font-size: 14.5px; font-weight: 700; color: var(--agent-text-primary); letter-spacing: -0.2px; margin-top: 3px; }
  .wp-opt-desc { font-size: 12.5px; line-height: 1.45; color: var(--agent-text-muted); margin-top: 3px; }
  .wp-opt-tag { margin-top: 8px; font-size: 10.5px; font-weight: 700; color: var(--agent-text-muted);
    background: var(--agent-hover-shade, rgba(45,24,16,0.05)); border: 0.5px solid var(--agent-border-subtle);
    padding: 2px 8px; border-radius: 999px; }

  .wp-foot { margin: 18px 2px 0; font-size: 12px; line-height: 1.55; color: var(--agent-text-muted); }
`;
