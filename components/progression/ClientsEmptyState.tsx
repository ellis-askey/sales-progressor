"use client";

// Onboarding empty state for /agent/clients (a progression-business owner with
// no clients yet). "Warm glass" direction: frosted glass panels floating over a
// warm coral-and-blue glow, the add form on the left and a decorative roster on
// the right that SHUFFLES on hover (auto-cycles) or on a vertical swipe (mobile).
// Fills the width on desktop, stacks on mobile. Canonical Button + .agent-input +
// .agent-glass; the panel gradient/glow are bespoke with dark overrides.
// Reduced-motion: no auto-shuffle, no float, no transitions.

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { UserPlus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { useAddClientForm } from "./useAddClientForm";

// Decorative only (aria-hidden): fictional agencies with illustrative logos —
// a taste of the populated roster, never real data.
const ROSTER: { name: string; agency: string; sales: number; img: string }[] = [
  { name: "Alex Turner", agency: "Riverside Estates", sales: 28, img: "/clients-preview/riverside.png" },
  { name: "Emma Collins", agency: "Birchwood Homes", sales: 17, img: "/clients-preview/birchwood.png" },
  { name: "Daniel Carter", agency: "Maple & Co", sales: 9, img: "/clients-preview/maple.png" },
];
const N = ROSTER.length;
const SLOT = 84; // vertical distance between stacked cards

export function ClientsEmptyState() {
  const f = useAddClientForm();

  // Shuffle: `offset` rotates which card sits in which slot. Hover auto-cycles;
  // a vertical swipe nudges it one step (mobile). Reduced-motion opts out of the
  // auto-cycle (swipe still works, just without the slide).
  const [offset, setOffset] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduced = useRef(false);
  const touchY = useRef<number | null>(null);

  useEffect(() => {
    reduced.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  function startShuffle() {
    if (reduced.current || timer.current) return;
    timer.current = setInterval(() => setOffset((o) => o + 1), 950);
  }
  function stopShuffle() {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  }
  function onTouchStart(e: React.TouchEvent) { touchY.current = e.touches[0].clientY; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchY.current == null) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    if (Math.abs(dy) > 28) setOffset((o) => o + (dy < 0 ? 1 : -1));
    touchY.current = null;
  }

  return (
    <div className="cwg">
      <div className="cwg-blob cwg-blob-1" aria-hidden />
      <div className="cwg-blob cwg-blob-2" aria-hidden />

      <div className="cwg-inner">
        <h1 className="cwg-title">Add your first client</h1>
        <p className="cwg-sub">Add the agents and agencies you progress sales for.</p>

        <div className="cwg-cols">
          {/* Form */}
          <div className="cwg-form agent-glass">
            <div className="cwg-field">
              <label className="cwg-label" htmlFor="cwg-name">Contact name</label>
              <input id="cwg-name" className="agent-input" value={f.agentName} onChange={(e) => f.setAgentName(e.target.value)} onBlur={f.blurName} placeholder="e.g. Sophie Bennett" maxLength={100} />
            </div>
            <div className="cwg-row">
              <div className="cwg-field">
                <label className="cwg-label" htmlFor="cwg-email">Email address</label>
                <input id="cwg-email" className="agent-input" type="email" value={f.agentEmail} onChange={(e) => f.setAgentEmail(e.target.value)} onBlur={f.blurEmail} placeholder="sophie@oakandkey.co.uk" maxLength={255} aria-invalid={f.emailInvalid || undefined} />
              </div>
              <div className="cwg-field">
                <label className="cwg-label" htmlFor="cwg-agency">Agency name</label>
                <input id="cwg-agency" className="agent-input" value={f.agencyName} onChange={(e) => f.setAgencyName(e.target.value)} onBlur={f.blurAgency} placeholder="e.g. Oak & Key" maxLength={120} />
              </div>
            </div>

            {f.emailInvalid && <p className="cwg-err">Enter a valid email address.</p>}
            {f.error && <p className="cwg-err">{f.error}</p>}
            <p className="cwg-help">We&rsquo;ll email them an invite to set up their login. They&rsquo;ll only have access to their own sales.</p>

            <Button variant="primary" size="md" className="cwg-btn" onClick={f.submit} disabled={!f.canSubmit} loading={f.adding}>
              <UserPlus size={16} weight="bold" />
              Add client
            </Button>
          </div>

          {/* Decorative shuffling roster */}
          <aside className="cwg-roster" aria-hidden onMouseEnter={startShuffle} onMouseLeave={stopShuffle} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <p className="cwg-roster-title">Your clients</p>
            <div className="cwg-stack">
              {ROSTER.map((r, i) => {
                const slot = (((i + offset) % N) + N) % N;
                return (
                  <div
                    className="cwg-rcard agent-glass"
                    key={r.name}
                    style={{ transform: `translateY(${slot * SLOT}px) translateX(${(slot - 1) * 3}px) rotate(${(slot - 1) * 1.1}deg)`, zIndex: N - slot }}
                  >
                    <span className="cwg-tile"><img src={r.img} alt="" width={48} height={48} /></span>
                    <div className="cwg-rmain">
                      <div className="cwg-rname">{r.name}</div>
                      <div className="cwg-ragency">{r.agency}</div>
                    </div>
                    <div className="cwg-rstat">
                      <div className="cwg-rnum">{r.sales}</div>
                      <div className="cwg-rsub">active</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>

      <style>{`
        .cwg {
          position: relative; overflow: hidden; width: 100%;
          border-radius: 24px; padding: clamp(26px, 4vw, 46px);
          border: 1px solid var(--agent-border-subtle);
          background:
            linear-gradient(135deg, rgba(var(--agent-coral-rgb),0.11), transparent 52%),
            linear-gradient(305deg, rgba(64,116,214,0.09), transparent 55%),
            rgba(255,255,255,0.32);
          box-shadow: 0 26px 62px -34px rgba(40,26,20,0.30);
          animation: cwg-in 420ms cubic-bezier(0.16,1,0.3,1) both;
        }
        :root[data-theme="dark"] .cwg {
          background:
            linear-gradient(135deg, rgba(var(--agent-coral-rgb),0.15), transparent 52%),
            linear-gradient(305deg, rgba(108,151,232,0.12), transparent 55%),
            rgba(255,255,255,0.03);
          box-shadow: 0 34px 74px -38px rgba(0,0,0,0.72);
        }
        @keyframes cwg-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

        .cwg-blob { position: absolute; border-radius: 50%; filter: blur(66px); pointer-events: none; z-index: 0; }
        .cwg-blob-1 { width: 360px; height: 360px; top: -120px; right: -70px; opacity: 0.5;
          background: radial-gradient(circle at 40% 40%, rgba(var(--agent-coral-rgb),0.95), transparent 68%); }
        .cwg-blob-2 { width: 320px; height: 320px; bottom: -130px; left: 26%; opacity: 0.42;
          background: radial-gradient(circle at 50% 50%, rgba(70,124,224,0.9), transparent 70%); }
        :root[data-theme="dark"] .cwg-blob-1 { opacity: 0.4; }
        :root[data-theme="dark"] .cwg-blob-2 { opacity: 0.34; }

        .cwg-inner { position: relative; z-index: 1; }
        .cwg-title { margin: 0 0 8px; font-size: clamp(28px, 4vw, 40px); font-weight: 820; letter-spacing: -0.03em; line-height: 1.05; color: var(--agent-text-primary); text-wrap: balance; }
        .cwg-sub { margin: 0; font-size: 14.5px; color: var(--agent-text-secondary); line-height: 1.5; max-width: 42ch; }

        .cwg-cols { display: grid; grid-template-columns: 1fr 0.9fr; gap: 28px; align-items: center; margin-top: 30px; }

        /* Form card */
        .cwg-form { border-radius: 18px; padding: 22px; }
        .cwg-field { margin-bottom: 12px; }
        .cwg-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .cwg-label { display: block; font-size: 12px; font-weight: 600; color: var(--agent-text-secondary); margin-bottom: 6px; }
        .cwg-err { margin: 12px 0 0; font-size: 12.5px; color: #C7401F; }
        .cwg-help { margin: 12px 0 0; font-size: 12px; color: var(--agent-text-muted); line-height: 1.5; }
        .cwg-btn { width: 100%; margin-top: 16px; gap: 8px; }

        /* Shuffling roster */
        .cwg-roster { position: relative; animation: cwg-float 6s ease-in-out infinite; touch-action: pan-x; }
        .cwg-roster-title { margin: 0 0 14px; font-size: 13px; font-weight: 700; letter-spacing: 0.02em; color: var(--agent-text-secondary); padding-left: 4px; }
        @keyframes cwg-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .cwg-stack { position: relative; height: 240px; }
        .cwg-rcard {
          position: absolute; top: 0; left: 0; right: 0; height: 72px; box-sizing: border-box;
          display: flex; align-items: center; gap: 12px; padding: 0 14px; border-radius: 15px;
          transition: transform 520ms cubic-bezier(0.22,1,0.36,1); will-change: transform;
        }
        .cwg-tile { width: 48px; height: 48px; border-radius: 12px; overflow: hidden; flex-shrink: 0; border: 0.5px solid var(--agent-border-subtle); }
        .cwg-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cwg-rmain { min-width: 0; flex: 1; }
        .cwg-rname { font-size: 14px; font-weight: 700; color: var(--agent-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cwg-ragency { font-size: 12px; color: var(--agent-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cwg-rstat { text-align: right; flex-shrink: 0; }
        .cwg-rnum { font-size: 18px; font-weight: 800; color: var(--agent-text-primary); line-height: 1; font-variant-numeric: tabular-nums; }
        .cwg-rsub { font-size: 10.5px; color: var(--agent-text-muted); margin-top: 2px; }

        @media (max-width: 820px) {
          .cwg-cols { grid-template-columns: 1fr; gap: 24px; }
        }
        @media (max-width: 480px) {
          .cwg-row { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cwg, .cwg-roster { animation: none; }
          .cwg-rcard { transition: none; }
        }
      `}</style>
    </div>
  );
}
