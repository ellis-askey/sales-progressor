"use client";

import { useState } from "react";
import "../../../claim/styles/claim-flow.css";

// ─── Preview page: A/B three background options for the claim shell ──────────
// /agent/polish/claim-bg
// Not deployed to the live claim shell — Ellis picks one of the three.

type Option = "A" | "B" | "C";

const SCOPED_CSS = `
  .bg-stage {
    position: relative;
    width: 100%;
    min-height: 100vh;
    overflow: hidden;
    padding: 40px 24px;
    box-sizing: border-box;
  }

  /* ── Option A — subtle static bloom (single soft coral wash, top-right) ── */
  .bg-A {
    background:
      radial-gradient(ellipse 60% 50% at 92% 8%, rgba(255,107,74,.10) 0%, transparent 60%),
      #FDF9F5;
  }

  /* ── Option B — drifting two-orb gradient (animated, alive) ── */
  .bg-B {
    background: #FDF9F5;
    position: relative;
  }
  .bg-B::before,
  .bg-B::after {
    content: "";
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    z-index: 0;
  }
  .bg-B::before {
    width: 480px; height: 480px;
    background: rgba(255,107,74,.18);
    top: -120px; left: -120px;
    animation: bg-B-drift-a 28s ease-in-out infinite alternate;
  }
  .bg-B::after {
    width: 520px; height: 520px;
    background: rgba(255,180,77,.16);
    bottom: -160px; right: -160px;
    animation: bg-B-drift-b 32s ease-in-out infinite alternate;
  }
  @keyframes bg-B-drift-a {
    0%   { transform: translate(0, 0); }
    100% { transform: translate(80px, 60px); }
  }
  @keyframes bg-B-drift-b {
    0%   { transform: translate(0, 0); }
    100% { transform: translate(-60px, -80px); }
  }
  .bg-B > * { position: relative; z-index: 1; }

  /* ── Option C — diagonal warm gradient + corner accent (static) ── */
  .bg-C {
    background:
      radial-gradient(ellipse 50% 40% at 100% 0%, rgba(255,107,74,.14) 0%, transparent 55%),
      linear-gradient(135deg, #FDF9F5 0%, #FBF2EA 100%);
  }

  /* ── Hero card shown on each background for context ── */
  .bg-demo-card {
    max-width: 520px;
    margin: 60px auto;
    background: var(--claim-surface);
    border-radius: var(--claim-r-card);
    border: 1px solid var(--claim-border);
    padding: 32px 28px;
    box-shadow: 0 2px 12px rgba(26,29,41,.06);
  }
  .bg-demo-eyebrow {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    color: var(--claim-coral); margin: 0 0 12px;
  }
  .bg-demo-h1 {
    font-size: 28px; font-weight: 700; line-height: 1.2; color: var(--claim-text-1);
    margin: 0 0 12px; letter-spacing: -0.01em;
  }
  .bg-demo-sub {
    font-size: 14px; line-height: 1.6; color: var(--claim-text-2);
    margin: 0 0 20px;
  }
  .bg-demo-cta {
    display: inline-block; padding: 12px 24px;
    background: var(--claim-coral); color: #fff;
    border-radius: 10px; font-weight: 700; font-size: 14px;
    text-decoration: none;
  }

  /* ── Picker ── */
  .bg-picker {
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    z-index: 100;
    background: rgba(255,255,255,.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0,0,0,.08);
    border-radius: 12px;
    padding: 6px;
    display: flex; gap: 4px;
    box-shadow: 0 4px 16px rgba(0,0,0,.08);
  }
  .bg-picker button {
    appearance: none; border: none; cursor: pointer;
    padding: 8px 14px;
    font-size: 12px; font-weight: 600;
    border-radius: 8px;
    background: transparent;
    color: rgba(0,0,0,.55);
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    transition: background 150ms, color 150ms;
  }
  .bg-picker button.on {
    background: var(--claim-coral);
    color: #fff;
  }
  .bg-picker button:not(.on):hover {
    background: rgba(0,0,0,.05);
    color: rgba(0,0,0,.85);
  }

  .bg-label {
    position: absolute; bottom: 24px; left: 24px;
    font-size: 11px; font-family: monospace;
    color: rgba(0,0,0,.45);
    background: rgba(255,255,255,.7);
    padding: 6px 10px;
    border-radius: 6px;
    z-index: 2;
  }
`;

const LABELS: Record<Option, string> = {
  A: "Option A · subtle static bloom (top-right wash, no motion)",
  B: "Option B · drifting two-orb gradient (animated)",
  C: "Option C · diagonal warm gradient + corner accent (static)",
};

export default function ClaimBgPreviewPage() {
  const [option, setOption] = useState<Option>("A");

  return (
    <>
      <style>{SCOPED_CSS}</style>

      <div className="bg-picker">
        {(["A", "B", "C"] as Option[]).map((opt) => (
          <button
            key={opt}
            type="button"
            className={option === opt ? "on" : ""}
            onClick={() => setOption(opt)}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className={`bg-stage bg-${option}`}>
        <div className="bg-demo-card">
          <p className="bg-demo-eyebrow">FOSTER & CO · BRISTOL</p>
          <h1 className="bg-demo-h1">Your sale is part of a live chain.</h1>
          <p className="bg-demo-sub">
            Jane Smith at Foster &amp; Co has linked 47 Oak Road to their file. Join to see where the chain stands.
          </p>
          <a href="#" onClick={(e) => e.preventDefault()} className="bg-demo-cta">
            Claim this sale
          </a>
        </div>

        <div className="bg-label">{LABELS[option]}</div>
      </div>
    </>
  );
}
