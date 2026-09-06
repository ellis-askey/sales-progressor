"use client";

// Shared "explore the demo sale" flow used by the New Sale hero and the All
// Files empty state. Owns the intro modal + the "Getting your demo ready"
// transition, provisions (or reopens) the demo, and routes into the star file.
// Returns { launch, node }: render {node} once, call launch() to start —
// launch(true) skips the intro and goes straight into the transition.
// See app/actions/demo.ts and lib/services/demo-sale.ts.

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Check, CircleNotch, ArrowRight } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { getOrCreateDemoSaleAction } from "@/app/actions/demo";
import { DemoSalePreview } from "@/components/agent/DemoSalePreview";

const STEPS = ["Loading the sale", "Adding its progress", "Getting everything ready"];
const MIN_TRANSITION_MS = 1500;

type Stage = "closed" | "intro" | "loading";

export function useDemoExplore() {
  const router = useRouter();
  const { theme } = usePortalTheme();
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<Stage>("closed");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => setMounted(true), []);

  // ≤1060px switches the intro from the landscape modal to a full-screen pop-up.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1060px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Lock the page scroll behind the modal while it's open. The root scroller is
  // <html> here (content flows in normal document flow), so lock both html + body.
  useEffect(() => {
    if (stage === "closed") return;
    const htmlPrev = document.documentElement.style.overflow;
    const bodyPrev = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = htmlPrev;
      document.body.style.overflow = bodyPrev;
    };
  }, [stage]);

  // Play the welcome-style zoom-through exit, then close. Reduced-motion skips it.
  function requestClose() {
    if (closing) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStage("closed");
      return;
    }
    setClosing(true);
  }

  // Escape closes the intro only — never interrupt the ready transition.
  useEffect(() => {
    if (stage !== "intro") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, closing]);

  async function explore() {
    setError(null);
    setStage("loading");
    setStep(0);
    const startedAt = Date.now();
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 480);
    try {
      const { transactionId } = await getOrCreateDemoSaleAction();
      clearInterval(ticker);
      setStep(STEPS.length);
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_TRANSITION_MS) await new Promise((r) => setTimeout(r, MIN_TRANSITION_MS - elapsed));
      router.push(`/agent/transactions/${transactionId}`);
    } catch (e) {
      clearInterval(ticker);
      const msg = e instanceof Error ? e.message : "";
      setError(msg.includes("already have a sale") ? "You already have a sale on this account." : "We couldn't open the demo. Try again.");
      setStage("intro");
    }
  }

  function launch(skipIntro = false) {
    setError(null);
    setClosing(false);
    if (skipIntro) void explore();
    else setStage("intro");
  }

  const closeBtn = (
    <button onClick={requestClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-sm" style={{ position: "absolute", top: 14, right: 14, zIndex: 3 }}>
      <X size={14} weight="bold" />
    </button>
  );
  const promoHead = (
    <>
      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FF6B4A" }}>See it for yourself</span>
      <h2 style={{ margin: "14px 0 0", fontSize: 34, lineHeight: 1.08, fontWeight: 800, letterSpacing: "-0.8px", color: "#0F1B2D" }}>
        Step inside a sale<span style={{ color: "#FF6B4A" }}>.</span>
      </h2>
      <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.55, color: "#54617d", maxWidth: 360 }}>
        We&apos;ve set one up for you, with the progress, conversations and updates you&apos;d expect to see along the way.
      </p>
    </>
  );
  const ctaGroup = (align: "space-between" | "center") => (
    <>
      <button type="button" onClick={() => void explore()} className="welcome-cta" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: align, gap: 10, border: "none", borderRadius: 14, cursor: "pointer", padding: "15px 20px", fontSize: 15, fontWeight: 700, color: "#fff" }}>
        Explore the demo sale
        <ArrowRight size={18} weight="bold" />
      </button>
      <p style={{ margin: "12px 0 0", textAlign: align === "center" ? "center" : "left", fontSize: 12.5, color: "#9aa3b2" }}>Sample data &middot; Nothing you do here affects a real sale.</p>
      {error && <p role="alert" style={{ margin: "10px 0 0", textAlign: align === "center" ? "center" : "left", fontSize: 12.5, color: "#dc2626" }}>{error}</p>}
    </>
  );
  const onAnimEnd = () => { if (closing) { setStage("closed"); setClosing(false); } };

  const node = mounted && stage !== "closed"
    ? createPortal(
        <div
          data-theme={theme}
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", ["--agent-backdrop-bg" as string]: "rgba(9, 12, 20, 0.5)" } as React.CSSProperties}
          onClick={stage === "intro" ? requestClose : undefined}
        >
          <div className={`fixed inset-0 agent-backdrop-overlay${closing ? " welcome-backdrop-closing" : ""}`} />

          {stage === "loading" ? (
            <div className="agent-modal" role="dialog" aria-modal="true" style={{ maxWidth: 440, width: "calc(100vw - 40px)", maxHeight: "92vh", position: "relative", padding: 0, overflow: "hidden", background: "var(--agent-surface-elevated)", animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ padding: "34px 28px", display: "flex", flexDirection: "column", gap: 22, alignItems: "center", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>Getting your demo ready&hellip;</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, alignSelf: "stretch", maxWidth: 240, margin: "0 auto" }}>
                  {STEPS.map((label, i) => {
                    const done = step > i;
                    const active = step === i;
                    return (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 11, opacity: done || active ? 1 : 0.4, transition: "opacity 200ms" }}>
                        <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: done ? "var(--agent-coral-deep)" : "transparent", border: done ? "none" : "1.5px solid var(--agent-border-strong, rgba(15,23,42,0.18))", color: done ? "#fff" : "var(--agent-coral-deep)" }}>
                          {done ? <Check size={13} weight="bold" /> : active ? <CircleNotch size={13} weight="bold" className="agent-spin" /> : null}
                        </span>
                        <span style={{ fontSize: 13.5, fontWeight: done || active ? 600 : 500, color: "var(--agent-text-primary)" }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : isMobile ? (
            /* Mobile — full-screen pop-up, slides up. Not scrollable: content that
               overflows the viewport is simply clipped (that's fine). */
            <div role="dialog" aria-modal="true" style={{ position: "relative", width: "100vw", height: "100dvh", background: "var(--agent-surface-elevated)", overflow: "hidden", display: "flex", flexDirection: "column", animation: closing ? "demo-slide-down 280ms cubic-bezier(0.4,0,1,1) both" : "demo-slide-up 340ms cubic-bezier(0.16,1,0.3,1) both" }} onClick={(e) => e.stopPropagation()} onAnimationEnd={onAnimEnd}>
              {closeBtn}
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "46px 22px 0" }}>{promoHead}</div>
                <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "18px 16px 0" }}>
                  <DemoSalePreview />
                </div>
              </div>
              <div style={{ flex: "none", padding: "14px 18px calc(16px + env(safe-area-inset-bottom))", borderTop: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)" }}>
                {ctaGroup("center")}
              </div>
            </div>
          ) : (
            /* Desktop — landscape modal (unchanged) */
            <div className="agent-modal" role="dialog" aria-modal="true" style={{ maxWidth: 1180, width: "calc(100vw - 40px)", maxHeight: "92vh", position: "relative", padding: 0, overflow: "hidden", background: "var(--agent-surface-elevated)", animation: closing ? "welcome-zoom-out 420ms cubic-bezier(0.4,0,1,1) both" : "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both" }} onClick={(e) => e.stopPropagation()} onAnimationEnd={onAnimEnd}>
              {closeBtn}
              <div style={{ display: "flex", maxHeight: "92vh" }}>
                <div style={{ flex: "0 0 43%", minWidth: 340, maxWidth: 520, background: "#ffffff url('/agent/demo-modal-bg.png') no-repeat left bottom", backgroundSize: "620px auto", padding: "48px 44px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  {promoHead}
                  <div style={{ marginTop: 26, maxWidth: 360 }}>{ctaGroup("space-between")}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0, background: "linear-gradient(160deg, #F7F3ED, #EFE9E2)", padding: "26px 24px", overflowY: "auto" }}>
                  <DemoSalePreview />
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return { launch, node };
}
