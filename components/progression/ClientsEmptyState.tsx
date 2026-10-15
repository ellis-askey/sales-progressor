"use client";

// Onboarding empty state for /agent/clients (a progression-business owner with
// no clients yet). "Warm glass" direction: frosted glass panels over a warm
// coral-and-blue glow, the add form on the left and a decorative roster on the
// right whose cards LIFT as the cursor passes over each. Fills the width on
// desktop, stacks on mobile. Canonical Button + .agent-input + .agent-glass; the
// primary button wears the reminders/enquiries polished gradient (.enq-btn-
// primary2). Panel gradient/glow + lift honour reduced-motion.

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { UserPlus, PaperPlaneTilt } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { useAddClientForm } from "./useAddClientForm";
import { useConnectAgencyForm } from "./useConnectAgencyForm";
import { SentRequestsList } from "./SentRequestsList";
import type { OutgoingConnectionRequest } from "@/lib/services/progression-clients";

// useLayoutEffect on the client, useEffect on the server — avoids React's SSR
// warning while keeping the pre-paint height measurement that prevents a flash.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Decorative only (aria-hidden): fictional agencies with illustrative logos —
// a taste of the populated roster, never real data.
const ROSTER: { name: string; agency: string; sales: number; img: string }[] = [
  { name: "Alex Turner", agency: "Riverside Estates", sales: 28, img: "/clients-preview/riverside.png" },
  { name: "Emma Collins", agency: "Birchwood Homes", sales: 17, img: "/clients-preview/birchwood.png" },
  { name: "Daniel Carter", agency: "Maple & Co", sales: 9, img: "/clients-preview/maple.png" },
];

export function ClientsEmptyState({ pendingRequests = [] }: { pendingRequests?: OutgoingConnectionRequest[] }) {
  const [mode, setMode] = useState<"new" | "connect">("new");
  const f = useAddClientForm();
  const c = useConnectAgencyForm();

  // Smoothly animate the card's height as the two forms (different heights)
  // swap. We pin the current height before switching, then let a layout effect
  // measure the new content and transition to it. overflow is only clipped
  // while animating, so the primary button's glow isn't cut off at rest.
  const innerRef = useRef<HTMLDivElement>(null);
  const [bodyH, setBodyH] = useState<number | undefined>(undefined);
  const [animating, setAnimating] = useState(false);

  function switchMode(next: "new" | "connect") {
    if (next === mode) return;
    const el = innerRef.current;
    if (el) setBodyH(el.offsetHeight); // pin the height we're leaving
    setAnimating(true);
    setMode(next);
  }

  useIsoLayoutEffect(() => {
    if (!animating || !innerRef.current) return;
    // Measure the freshly-swapped content and transition to it.
    setBodyH(innerRef.current.offsetHeight);
    // Safety net: if the heights match, no transitionend fires, so reset here.
    const t = setTimeout(() => { setAnimating(false); setBodyH(undefined); }, 400);
    return () => clearTimeout(t);
  }, [mode, animating]);

  return (
    <div className={"cwg" + (pendingRequests.length > 0 ? " has-pending" : "")}>
      <div className="cwg-blob cwg-blob-1" aria-hidden />
      <div className="cwg-blob cwg-blob-2" aria-hidden />

      <div className="cwg-inner">
        <h1 className="cwg-title">Add your first client</h1>
        <p className="cwg-sub">Add the agents and agencies you work with, and manage everything in one place.</p>

        <div className="cwg-cols">
          {/* Form */}
          <div className="cwg-form agent-glass">
            {/* Two routes: a brand-new agency, or one already on Sales Progressor
                (the second is how you connect to an agency another progressor
                has already brought onto the platform). */}
            <div className="cwg-seg" role="tablist" aria-label="How to add this client">
              <span className="cwg-seg-pill" data-mode={mode} aria-hidden />
              <button type="button" role="tab" aria-selected={mode === "new"} className={"cwg-segbtn" + (mode === "new" ? " on" : "")} onClick={() => switchMode("new")}>A new agency</button>
              <button type="button" role="tab" aria-selected={mode === "connect"} className={"cwg-segbtn" + (mode === "connect" ? " on" : "")} onClick={() => switchMode("connect")}>Already on Sales Progressor</button>
            </div>

            <div
              className={"cwg-animh" + (animating ? " on" : "")}
              style={{ height: bodyH }}
              onTransitionEnd={(e) => { if (e.propertyName === "height") { setAnimating(false); setBodyH(undefined); } }}
            >
              <div ref={innerRef}>
                <div key={mode} className="cwg-pane">
                {mode === "new" ? (
                  <>
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

                    <div className="cwg-field">
                      <label className="cwg-label" htmlFor="cwg-fee">Your fee per sale <span className="cwg-opt">optional</span></label>
                      <div className="cwg-money">
                        <span className="cwg-money-sym">£</span>
                        <input id="cwg-fee" className="agent-input" inputMode="numeric" value={f.feePounds} onChange={(e) => f.setFeePounds(e.target.value.replace(/[^0-9]/g, ""))} placeholder="300" maxLength={9} />
                      </div>
                      <p className="cwg-feehint">A flat amount per sale. You can set this (or tiered / % pricing) on their page later. A fee is needed before adding a sale.</p>
                    </div>

                    {f.emailInvalid && <p className="cwg-err">Enter a valid email address.</p>}
                    {f.error && <p className="cwg-err">{f.error}</p>}
                    <p className="cwg-help">We&rsquo;ll email them an invite to set up their login. They&rsquo;ll only be able to see their own sales.</p>

                    <Button variant="primary" size="md" className="cwg-btn" onClick={f.submit} disabled={!f.canSubmit} loading={f.adding}>
                      <UserPlus size={16} weight="bold" />
                      Add client
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="cwg-field">
                      <label className="cwg-label" htmlFor="cwg-cemail">Their agency&rsquo;s email</label>
                      <input id="cwg-cemail" className="agent-input" type="email" value={c.email} onChange={(e) => c.setEmail(e.target.value)} onBlur={c.blurEmail} placeholder="hello@theiragency.co.uk" maxLength={255} />
                    </div>

                    <div className="cwg-field">
                      <label className="cwg-label" htmlFor="cwg-cfee">Your fee per sale <span className="cwg-opt">optional</span></label>
                      <div className="cwg-money">
                        <span className="cwg-money-sym">£</span>
                        <input id="cwg-cfee" className="agent-input" inputMode="numeric" value={c.feePounds} onChange={(e) => c.setFeePounds(e.target.value.replace(/[^0-9]/g, ""))} placeholder="300" maxLength={9} />
                      </div>
                    </div>

                    {c.error && <p className="cwg-err">{c.error}</p>}
                    <p className="cwg-help">We&rsquo;ll send their director a request. Nothing is shared until they accept, and they&rsquo;ll only see the sales you assign to them.</p>

                    <Button variant="primary" size="md" className="cwg-btn" onClick={c.submit} disabled={!c.canSubmit} loading={c.sending}>
                      <PaperPlaneTilt size={16} weight="bold" />
                      Send connection request
                    </Button>
                  </>
                )}
                </div>
              </div>
            </div>
          </div>

          {/* Decorative roster — each card lifts as the cursor passes over it.
              No "Your clients" label here: with no clients yet it read as if these
              illustrative agencies were real. The real label returns with the
              populated ClientsWorkspace once a client is added. */}
          <aside className="cwg-roster" aria-hidden>
            <div className="cwg-stack">
              {ROSTER.map((r, i) => (
                <div className={`cwg-rcard agent-glass cwg-rcard-${i}`} key={r.name}>
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
              ))}
            </div>
          </aside>
        </div>

        {/* Pending connection requests this owner has sent (awaiting accept). */}
        {pendingRequests.length > 0 && (
          <div className="cwg-sent">
            <SentRequestsList requests={pendingRequests} />
          </div>
        )}
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
          /* Keep .cwg promoted to its own compositing layer at ALL times. The
             blurred blobs + will-change roster cards each become their own layer,
             and WebKit/Chrome only clip composited children to a rounded parent
             when the parent is itself a layer. Without this the right corners
             (top: coral blob, bottom: roster) escape the border-radius clip once
             the entrance animation settles to transform:none and read as square. */
          transform: translateZ(0);
          animation: cwg-in 420ms cubic-bezier(0.16,1,0.3,1) both;
        }
        :root[data-theme="dark"] .cwg {
          background:
            linear-gradient(135deg, rgba(var(--agent-coral-rgb),0.15), transparent 52%),
            linear-gradient(305deg, rgba(108,151,232,0.12), transparent 55%),
            rgba(255,255,255,0.03);
          box-shadow: 0 34px 74px -38px rgba(0,0,0,0.72);
        }
        @keyframes cwg-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateZ(0); } }

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
        .cwg-sent { margin-top: 26px; max-width: 520px; }

        /* Form card */
        .cwg-form { border-radius: 18px; padding: 22px; }

        /* Route toggle: new agency vs connect an existing one. A single pill
           slides between the two options rather than each button toggling its
           own background. */
        .cwg-seg { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; margin-bottom: 18px;
          border-radius: 12px; background: var(--agent-surface-sunken, rgba(0,0,0,0.04)); border: 0.5px solid var(--agent-border-subtle); }
        .cwg-seg-pill { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc(50% - 6px); border-radius: 9px;
          background: var(--agent-surface, #fff); box-shadow: 0 1px 2px rgba(20,14,10,0.06), 0 0 0 0.5px var(--agent-border-subtle);
          transition: transform 280ms cubic-bezier(0.22,1,0.36,1); pointer-events: none; z-index: 0; }
        .cwg-seg-pill[data-mode="connect"] { transform: translateX(calc(100% + 4px)); }
        .cwg-segbtn { position: relative; z-index: 1; appearance: none; border: none; background: transparent; cursor: pointer; border-radius: 9px; padding: 9px 10px;
          font-size: 12.5px; font-weight: 640; color: var(--agent-text-muted); transition: color .18s; }
        .cwg-segbtn:hover:not(.on) { color: var(--agent-text-secondary); }
        .cwg-segbtn.on { color: var(--agent-text-primary); }

        /* Animated-height wrapper: the two forms differ in height, so the card
           grows/shrinks smoothly on switch. Only clip while animating, so the
           primary button's glow isn't cut off at rest. */
        .cwg-animh { transition: height 300ms cubic-bezier(0.22,1,0.36,1); }
        .cwg-animh.on { overflow: hidden; }
        .cwg-pane { animation: cwg-pane-in 260ms ease both; }
        @keyframes cwg-pane-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .cwg-field { margin-bottom: 12px; }
        .cwg-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .cwg-label { display: block; font-size: 12px; font-weight: 600; color: var(--agent-text-secondary); margin-bottom: 6px; }
        .cwg-opt { font-weight: 400; font-size: 11px; color: var(--agent-text-muted); margin-left: 4px; }
        .cwg-money { position: relative; }
        .cwg-money-sym { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--agent-text-muted); font-weight: 600; pointer-events: none; }
        .cwg-money .agent-input { padding-left: 24px; }
        .cwg-feehint { margin: 7px 0 0; font-size: 11px; color: var(--agent-text-muted); line-height: 1.5; }
        .cwg-err { margin: 12px 0 0; font-size: 12.5px; color: #C7401F; }
        .cwg-help { margin: 12px 0 0; font-size: 12px; color: var(--agent-text-muted); line-height: 1.5; }

        /* Primary button: the reminders/enquiries polished gradient (matches
           .enq-btn-primary2 / .rem-chase-go) — a vertical coral fill + top sheen. */
        .cwg-btn { width: 100%; margin-top: 16px; gap: 8px;
          background: linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 16px rgba(var(--agent-coral-rgb),0.28); }
        .cwg-btn:hover:not(:disabled) { filter: brightness(1.04); transform: translateY(-1px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 20px rgba(var(--agent-coral-rgb),0.38); }
        .cwg-btn:active:not(:disabled) { transform: scale(0.98); }

        /* Roster — subtle scattered glass cards; each lifts on hover */
        .cwg-roster { position: relative; animation: cwg-float 6s ease-in-out infinite; }
        @keyframes cwg-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .cwg-stack { display: flex; flex-direction: column; gap: 12px; }
        .cwg-rcard {
          display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 15px;
          transition: transform 220ms cubic-bezier(0.22,1,0.36,1), box-shadow 220ms ease;
          will-change: transform;
        }
        .cwg-rcard-0 { transform: rotate(0.6deg); }
        .cwg-rcard-1 { transform: rotate(-1deg) translateX(-5px); }
        .cwg-rcard-2 { transform: rotate(0.8deg) translateX(4px); }
        .cwg-rcard:hover { transform: translateY(-5px) scale(1.03); z-index: 2;
          box-shadow: 0 18px 34px -14px rgba(40,26,20,0.4); }
        :root[data-theme="dark"] .cwg-rcard:hover { box-shadow: 0 20px 38px -14px rgba(0,0,0,0.6); }
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
          /* Once the layout stacks and there's a real pending request to show, the
             decorative mock roster would sit right on top of the live "Requests
             sent" row and read as clutter. Hide it in that case. */
          .cwg.has-pending .cwg-roster { display: none; }
        }
        @media (max-width: 480px) {
          .cwg-row { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cwg, .cwg-roster, .cwg-pane { animation: none; }
          .cwg-rcard, .cwg-seg-pill, .cwg-animh { transition: none; }
        }
      `}</style>
    </div>
  );
}
