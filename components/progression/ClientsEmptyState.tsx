"use client";

// Onboarding empty state for /agent/clients (a progression-business owner with
// no clients yet). Matches the agreed mock: a hero + three-step "how it works"
// row, a decorative "Your clients" preview card (hidden below the two-column
// breakpoint so it never clashes with the hero text), and the "Add a client"
// form. Canonical agent-btn classes carry the press/hover states; borders are
// hairline (var(--agent-border-subtle)); reduced-motion is honoured.

import type { ReactNode } from "react";
import {
  UserPlus, EnvelopeSimple, FileText, House, Leaf, Mountains,
  ArrowRight, CaretRight, Buildings, X,
} from "@phosphor-icons/react";
import { useAddClientForm } from "./useAddClientForm";

const STEPS: { title: string; desc: string; icon: ReactNode; color: string }[] = [
  { title: "1. Add your client", desc: "Their name, agency and email.", icon: <UserPlus size={24} weight="regular" />, color: "var(--agent-coral-deep, #E2452A)" },
  { title: "2. We'll invite them", desc: "They'll get their own secure login.", icon: <EnvelopeSimple size={24} weight="regular" />, color: "#3B6FD4" },
  { title: "3. Start progressing", desc: "Add their sales and get to work.", icon: <FileText size={24} weight="regular" />, color: "#2F7D53" },
];

// Decorative only (aria-hidden): fictional agencies, glyph tiles — a taste of
// the populated list, never real data.
const PREVIEW: { name: string; agency: string; sales: number; icon: ReactNode; tileBg: string; iconColor: string }[] = [
  { name: "Alex Turner", agency: "Riverside Estates", sales: 28, icon: <House size={22} weight="fill" />, tileBg: "#1F2A44", iconColor: "#FF6B4A" },
  { name: "Emma Collins", agency: "Birchwood Homes", sales: 17, icon: <Leaf size={22} weight="fill" />, tileBg: "rgba(59,111,212,0.14)", iconColor: "#3B6FD4" },
  { name: "Daniel Carter", agency: "Maple & Co", sales: 9, icon: <Mountains size={22} weight="fill" />, tileBg: "rgba(176,142,74,0.18)", iconColor: "#2F7D53" },
];

export function ClientsEmptyState() {
  const f = useAddClientForm();

  return (
    <div className="ce-wrap">
      <div className="ce-top">
        {/* Hero */}
        <div className="ce-hero">
          <h1 className="ce-title">Add your first client</h1>
          <p className="ce-lead">Add the agents and agencies you progress sales for.</p>
          <p className="ce-detail">They&rsquo;ll have their own login, while you manage their sales from one place.</p>

          <div className="ce-steps">
            {STEPS.map((s, i) => (
              <div className="ce-step-group" key={s.title}>
                <div className="ce-step">
                  <span className="ce-step-ic" style={{ color: s.color }}>{s.icon}</span>
                  <p className="ce-step-title">{s.title}</p>
                  <p className="ce-step-desc">{s.desc}</p>
                </div>
                {i < STEPS.length - 1 && <ArrowRight size={16} weight="bold" className="ce-step-arrow" aria-hidden />}
              </div>
            ))}
          </div>
        </div>

        {/* Decorative preview */}
        <aside className="ce-preview agent-glass" aria-hidden>
          <p className="ce-preview-title">Your clients</p>
          <div className="ce-preview-rows">
            {PREVIEW.map((p) => (
              <div className="ce-prow" key={p.name}>
                <span className="ce-tile" style={{ background: p.tileBg, color: p.iconColor }}>{p.icon}</span>
                <div className="ce-prow-main">
                  <div className="ce-prow-name">{p.name}</div>
                  <div className="ce-prow-agency">{p.agency}</div>
                </div>
                <div className="ce-prow-stat">
                  <div className="ce-prow-num">{p.sales}</div>
                  <div className="ce-prow-sub">active sales</div>
                </div>
                <CaretRight size={18} weight="bold" className="ce-prow-caret" />
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Add a client form */}
      <div className="ce-form agent-glass">
        <div className="ce-form-hdr">
          <span className="ce-form-ic"><Buildings size={22} weight="bold" /></span>
          <span className="ce-form-title">Add a client</span>
          <button type="button" className="ce-form-x" onClick={f.reset} aria-label="Clear">
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="ce-fields">
          <div className="ce-field">
            <label className="ce-label" htmlFor="ce-name">Contact name</label>
            <input id="ce-name" className="ce-input" value={f.agentName} onChange={(e) => f.setAgentName(e.target.value)} placeholder="e.g. Sophie Bennett" maxLength={100} />
          </div>
          <div className="ce-field">
            <label className="ce-label" htmlFor="ce-email">Email address</label>
            <input id="ce-email" className="ce-input" type="email" value={f.agentEmail} onChange={(e) => f.setAgentEmail(e.target.value)} placeholder="sophie@oakandkey.co.uk" maxLength={255} />
          </div>
          <div className="ce-field">
            <label className="ce-label" htmlFor="ce-agency">Agency name</label>
            <input id="ce-agency" className="ce-input" value={f.agencyName} onChange={(e) => f.setAgencyName(e.target.value)} placeholder="e.g. Oak & Key" maxLength={120} />
          </div>
        </div>

        {f.error && <p className="ce-err">{f.error}</p>}

        <p className="ce-help">We&rsquo;ll email them an invite to set up their login. They&rsquo;ll only have access to their own sales.</p>

        <div className="ce-form-footer">
          <button type="button" className="agent-btn agent-btn-secondary agent-btn-md" onClick={f.reset}>
            Cancel
          </button>
          <button type="button" className="agent-btn agent-btn-primary agent-btn-md" onClick={f.submit} disabled={!f.canSubmit || f.adding} style={{ gap: 7 }}>
            <UserPlus size={15} weight="bold" />
            {f.adding ? "Adding…" : "Add client"}
          </button>
        </div>
      </div>

      <style>{`
        .ce-wrap {
          display: flex; flex-direction: column; gap: 24px; width: 100%;
          animation: ce-in 360ms cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes ce-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        /* Fills the content area (like every other page). The hero sits in the
           app's gradient hero card (its padding is what keeps the text off the
           edges); the preview is a fixed-ish right rail. */
        .ce-top { display: grid; grid-template-columns: 1fr minmax(340px, 440px); gap: 28px; align-items: start; }

        .ce-hero {
          position: relative; overflow: hidden;
          border-radius: var(--agent-radius-xl);
          padding: 36px 40px;
          border: 1px solid var(--agent-border-subtle);
          background: linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.13), rgba(var(--agent-coral-rgb),0.045) 54%, transparent 80%);
        }

        .ce-title { margin: 0 0 14px; font-size: clamp(30px, 4vw, 44px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.08; color: var(--agent-text-primary); text-wrap: balance; }
        .ce-lead { margin: 0 0 8px; font-size: 16.5px; font-weight: 500; color: var(--agent-text-secondary); line-height: 1.5; }
        .ce-detail { margin: 0; font-size: 14.5px; color: var(--agent-text-muted); line-height: 1.55; max-width: 460px; }

        .ce-steps { display: flex; align-items: flex-start; gap: 16px; margin-top: 34px; }
        .ce-step-group { display: contents; }
        .ce-step { display: flex; flex-direction: column; gap: 2px; flex: 1 1 0; max-width: 200px; }
        .ce-step-ic { margin-bottom: 8px; }
        .ce-step-title { margin: 0; font-size: 14.5px; font-weight: 700; color: var(--agent-text-primary); letter-spacing: -0.005em; }
        .ce-step-desc { margin: 0; font-size: 12.5px; color: var(--agent-text-muted); line-height: 1.45; }
        .ce-step-arrow { color: var(--agent-text-muted); opacity: 0.4; flex-shrink: 0; margin-top: 6px; }

        /* Decorative preview card — leans slightly in 3D (matches the reference),
           straightens on hover. Static tilt is fine under reduced-motion; only
           the hover transition is dropped there. */
        .ce-preview {
          border-radius: 20px; padding: 20px; margin-top: 10px; user-select: none;
          transform: perspective(1600px) rotateY(-8deg) rotateX(2.5deg);
          transform-origin: 65% 50%;
          box-shadow: 0 34px 64px -26px rgba(28,26,44,0.30), 0 12px 26px -14px rgba(28,26,44,0.18);
          transition: transform 480ms cubic-bezier(0.22,1,0.36,1), box-shadow 480ms ease;
          will-change: transform;
        }
        .ce-preview:hover {
          transform: perspective(1600px) rotateY(0deg) rotateX(0deg);
          box-shadow: 0 26px 52px -24px rgba(28,26,44,0.22);
        }
        .ce-preview-title { margin: 0 0 14px; font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: var(--agent-text-primary); }
        .ce-preview-rows { display: flex; flex-direction: column; gap: 10px; }
        .ce-prow { display: flex; align-items: center; gap: 14px; padding: 12px 14px; border-radius: 14px; background: rgba(255,255,255,0.55); border: 0.5px solid var(--agent-border-subtle); }
        .ce-tile { width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center; flex-shrink: 0; }
        .ce-prow-main { min-width: 0; flex: 1; }
        .ce-prow-name { font-size: 15px; font-weight: 700; color: var(--agent-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ce-prow-agency { font-size: 12.5px; color: var(--agent-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ce-prow-stat { text-align: right; flex-shrink: 0; }
        .ce-prow-num { font-size: 19px; font-weight: 800; color: var(--agent-text-primary); line-height: 1.1; font-variant-numeric: tabular-nums; }
        .ce-prow-sub { font-size: 11px; color: var(--agent-text-muted); }
        .ce-prow-caret { color: var(--agent-text-muted); opacity: 0.55; flex-shrink: 0; }

        /* Form card */
        .ce-form { border-radius: 18px; padding: 22px 24px; }
        .ce-form-hdr { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; }
        .ce-form-ic { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 11px; background: rgba(var(--agent-coral-rgb), 0.12); color: var(--agent-coral-deep, #E2452A); flex-shrink: 0; }
        .ce-form-title { flex: 1; font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: var(--agent-text-primary); }
        .ce-form-x { background: none; border: none; color: var(--agent-text-muted); cursor: pointer; padding: 3px; display: inline-flex; border-radius: 7px; transition: opacity 140ms ease, background 140ms ease; }
        .ce-form-x:hover { opacity: 0.65; background: rgba(0,0,0,0.04); }

        .ce-fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .ce-label { display: block; font-size: 12.5px; font-weight: 600; color: var(--agent-text-secondary); margin-bottom: 6px; }
        .ce-input { width: 100%; padding: 11px 13px; font-size: 14px; color: var(--agent-text-primary); background: var(--agent-input-bg, rgba(255,255,255,0.7)); border: 0.5px solid var(--agent-border-subtle); border-radius: 10px; outline: none; transition: border-color 140ms ease, box-shadow 140ms ease; box-sizing: border-box; }
        .ce-input::placeholder { color: var(--agent-text-muted); opacity: 0.7; }
        .ce-input:hover { border-color: rgba(var(--agent-coral-rgb), 0.4); }
        .ce-input:focus { border-color: var(--agent-coral-deep, #E2452A); box-shadow: 0 0 0 3px rgba(var(--agent-coral-rgb), 0.14); }

        .ce-err { margin: 12px 0 0; font-size: 12.5px; color: #C7401F; }
        .ce-help { margin: 14px 0 0; font-size: 12.5px; color: var(--agent-text-muted); line-height: 1.5; }
        .ce-form-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

        /* Hide the decorative preview once the two columns would crowd the hero. */
        @media (max-width: 1024px) {
          .ce-top { grid-template-columns: 1fr; }
          .ce-preview { display: none; }
        }
        @media (max-width: 720px) {
          .ce-fields { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .ce-steps { flex-direction: column; gap: 18px; }
          .ce-step { max-width: none; }
          .ce-step-arrow { display: none; }
          .ce-form-footer { flex-direction: column-reverse; }
          .ce-form-footer .agent-btn { width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ce-wrap { animation: none; }
          .ce-form-x, .ce-input, .ce-preview { transition: none; }
        }
      `}</style>
    </div>
  );
}
