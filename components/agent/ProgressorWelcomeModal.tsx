"use client";

// First-run welcome for an EXTERNAL progression-business OWNER. 3-step: what TSP
// does → choose which chases run → add your first client. Morphs its width/height
// between steps (centred modal ≥1200px, bottom drawer below), cross-fades the step
// content, and is theme-aware. Shared styles + structure with SelfManagedWelcomeModal.

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Users, BellRinging, WarningCircle, Storefront, Plus, ArrowRight, ArrowLeft, X } from "@phosphor-icons/react";
import { markProgressorWelcomeSeenAction } from "@/app/actions/profile";
import { saveProgressorChasePrefsAction } from "@/app/actions/progression-clients";
import { useDarkMode } from "@/lib/agent/use-theme";
import type { ThemeMode } from "@/lib/agent/theme-mode";
import type { ProgressorChasePrefs } from "@/lib/services/progressor-chase-prefs";
import { extractFirstName } from "@/lib/contacts/displayName";
import { WELCOME_STEPS_CSS } from "@/components/agent/welcome-steps-styles";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Pref = keyof ProgressorChasePrefs;

const CHASES: Array<{ key: Pref; title: string; desc: string }> = [
  { key: "client",    title: "Buyer & seller chases", desc: "When something’s waiting on a buyer or seller, we’ll follow up through their portal and keep nudging where needed." },
  { key: "solicitor", title: "Solicitor chases",      desc: "When something’s sitting with a solicitor, we’ll follow up for confirmation, including getting enquiries raised. If it stays outstanding, we’ll bring it back to you." },
  { key: "enquiries", title: "Enquiry chases",        desc: "When a solicitor owes replies to the other side’s enquiries, we’ll keep following up until they come back." },
  { key: "weekly",    title: "Weekly client updates", desc: "Buyers and sellers get a clear weekly update on where things stand and what happens next, sent from your business." },
  { key: "chain",     title: "Chain updates",         desc: "Connected agents are kept updated as things move, helping you keep the whole chain informed without repeating the same update to everyone." },
];

export function ProgressorWelcomeModal({
  businessName,
  userName = "",
  initialPrefs,
  themeMode,
}: {
  businessName: string;
  userName?: string;
  initialPrefs: ProgressorChasePrefs;
  themeMode: ThemeMode;
}) {
  void businessName; // heading is "Welcome to TSP"; kept for call-site stability
  const router = useRouter();
  const firstName = extractFirstName(userName);
  const { isDark } = useDarkMode(themeMode);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<ProgressorChasePrefs>(initialPrefs);
  const [phase, setPhase] = useState<"in" | "out">("in");

  const cardRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number | null; h: number } | null>(null);
  useIsoLayoutEffect(() => {
    function targetWidth(s: number): string {
      if (s === 1) return "min(1280px, calc(100vw - 288px))"; // chases
      if (s === 2) return "min(600px, calc(100vw - 288px))"; // ready
      return "min(864px, calc(100vw - 72px))";
    }
    function measure() {
      const card = cardRef.current, col = colRef.current;
      if (!card || !col) return;
      const isModal = window.innerWidth >= 1200;
      const prevT = card.style.transition, savedH = card.style.height, savedW = card.style.width;
      card.style.transition = "none";
      card.style.height = "auto";
      if (isModal) card.style.width = targetWidth(step);
      void card.offsetHeight;
      const h = Math.min(col.offsetHeight + 1, window.innerHeight - 56);
      const w = isModal ? card.offsetWidth : null;
      card.style.height = savedH;
      card.style.width = savedW;
      void card.offsetHeight;
      card.style.transition = prevT;
      setSize({ w, h });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step]);

  useEffect(() => {
    setMounted(true);
    markProgressorWelcomeSeenAction().catch(() => {});
    document.documentElement.classList.add("welcome-modal-open");
    return () => document.documentElement.classList.remove("welcome-modal-open");
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  function close() {
    if (closing) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(false);
      return;
    }
    setClosing(true);
  }

  function savePrefs() {
    // Fire-and-forget: the welcome must never block on the network. Owner-gated server-side.
    saveProgressorChasePrefsAction(prefs).catch(() => {});
  }

  function transitionTo(next: number) {
    if (next === step || phase === "out") return;
    setPhase("out");
    window.setTimeout(() => {
      setStep(next);
      window.setTimeout(() => setPhase("in"), 300);
    }, 220);
  }
  function goChases() { transitionTo(1); }
  function goReady() { savePrefs(); transitionTo(2); }
  function handleAddClient() { setVisible(false); router.push("/agent/clients"); }

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      className="pw-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        ["--agent-backdrop-bg" as string]: "rgba(0, 0, 0, 0.55)",
      } as React.CSSProperties}
      onClick={close}
    >
      <style dangerouslySetInnerHTML={{ __html: WELCOME_STEPS_CSS }} />
      <div className={`agent-backdrop-overlay welcome-backdrop${closing ? " welcome-backdrop-closing" : ""}`} />

      <div
        ref={cardRef}
        className={`pw-card${closing ? " pw-closing" : ""}`}
        data-pw-theme={isDark ? "dark" : "light"}
        style={{
          width: size?.w ?? undefined,
          height: size?.h ?? undefined,
          maxHeight: "calc(100vh - 56px)",
          transition: "width 300ms cubic-bezier(0.4,0,0.2,1), height 300ms cubic-bezier(0.4,0,0.2,1)",
        }}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={() => { if (closing) setVisible(false); }}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome"
      >
        <button onClick={close} aria-label="Close" className="pw-close">
          <X size={14} weight="bold" />
        </button>

        <div className="pw-col" ref={colRef}>
          <div className="pw-dots">
            {[0, 1, 2].map((n) => <span key={n} className={`pw-dot${n === step ? " on" : ""}`} />)}
          </div>

          <div className={`pw-stepbody${phase === "out" ? " is-out" : ""}`}>
          {step === 0 && (
            <>
              <span className="pw-eyebrow">You&apos;re in</span>
              <h2 className="pw-title">Welcome to TSP{firstName ? `, ${firstName}` : ""}.</h2>
              <p className="pw-lede">Your workspace is ready. Here’s how TSP helps you manage your clients, their sales and the chasing that comes with them.</p>

              <ul className="pw-points pw-badges">
                <li>
                  <span className="pw-chip"><Users size={24} weight="regular" /></span>
                  <span><span className="pw-pt-t">Keep every client in one place</span><span className="pw-pt-d">Add the agencies you work with and manage all of their sales from one workspace. Each agency only sees their own.</span></span>
                </li>
                <li>
                  <span className="pw-chip"><BellRinging size={24} weight="regular" /></span>
                  <span><span className="pw-pt-t">Let TSP handle the routine chasing</span><span className="pw-pt-d">Buyers, sellers and solicitors are automatically followed up for updates, giving you more time for the conversations that actually need you.</span></span>
                </li>
                <li>
                  <span className="pw-chip"><WarningCircle size={24} weight="regular" /></span>
                  <span><span className="pw-pt-t">Know exactly what needs you</span><span className="pw-pt-d">If something stalls or needs your attention, we’ll bring it to the surface so you know where to step in next.</span></span>
                </li>
                <li>
                  <span className="pw-chip"><Storefront size={24} weight="regular" /></span>
                  <span><span className="pw-pt-t">Your business stays front and centre</span><span className="pw-pt-d">Your clients see your business across their emails and portals. TSP works quietly in the background.</span></span>
                </li>
              </ul>

              <div className="pw-foot">
                <button className="pw-ghost" onClick={goReady}>Skip for now</button>
                <button className="pw-cta" onClick={goChases}>
                  Next: Choose your chases
                  <ArrowRight size={18} weight="bold" />
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <span className="pw-eyebrow">Set up · your chases</span>
              <h2 className="pw-title">We&apos;ll handle the routine chasing.</h2>
              <p className="pw-lede">These run automatically across the sales you’re progressing. They’re all switched on, but you can turn off anything you’d rather handle yourself.</p>

              <div className="pw-toggles">
                {CHASES.map((c) => (
                  <div className="pw-trow" key={c.key}>
                    <div className="pw-tx">
                      <span className="pw-tr-t">{c.title}</span>
                      <span className="pw-tr-d">{c.desc}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={prefs[c.key]}
                      aria-label={c.title}
                      className="pw-switch"
                      onClick={() => setPrefs((p) => ({ ...p, [c.key]: !p[c.key] }))}
                    >
                      <span className="pw-knob" />
                    </button>
                  </div>
                ))}
              </div>

              <p className="pw-footnote">You stay in control. Change any of these at any time in Settings. We’ll never chase more than twice for the same step.</p>

              <div className="pw-foot">
                <button className="pw-back" onClick={() => transitionTo(0)}><ArrowLeft size={15} weight="bold" /> Back</button>
                <button className="pw-cta" onClick={goReady}>
                  Save and continue
                  <ArrowRight size={18} weight="bold" />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand-icon.png" alt="TSP" className="pw-ready-logo" width={54} height={54} />
              <span className="pw-eyebrow" style={{ marginTop: 16 }}>All set</span>
              <h2 className="pw-title">You&apos;re ready to go.</h2>
              <p className="pw-lede">Add your first client to get started, or have a quick look around first.</p>

              <div className="pw-foot" style={{ justifyContent: "center" }}>
                <button className="pw-secondary" onClick={close}>Explore first</button>
                <button className="pw-cta" onClick={handleAddClient}>
                  <Plus size={18} weight="bold" /> Add your first client
                </button>
              </div>
              <div className="pw-linkrow" style={{ justifyContent: "center" }}>
                <button className="pw-back" onClick={() => transitionTo(1)}><ArrowLeft size={15} weight="bold" /> Back to chases</button>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
