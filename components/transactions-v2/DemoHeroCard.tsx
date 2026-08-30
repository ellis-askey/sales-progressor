"use client";

// The demo hero on the New Sale page (replaces the old AddDemoCard banner).
// Shown to an agency with no real sales yet. "See how it works" opens a light
// intro modal; "Explore demo sale" stands up (or reopens) the worked-example
// demo file with a brief "Getting your demo ready" transition, then routes
// straight into the demo's star file. Same entry logic as before — see
// lib/services/demo-sale.ts, app/actions/demo.ts and docs/active/demo-sale/SPEC.md.

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Play, X, Check, CircleNotch, Sparkle } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { getOrCreateDemoSaleAction } from "@/app/actions/demo";

// Reassuring statuses cycled during the transition. Polished, not fake theatre —
// they tick over ~1.4s; on a first build (which stands up a 3-file chain and
// takes longer) the last status holds until it's ready.
const STEPS = ["Loading the sale", "Adding its progress", "Getting everything ready"];
const MIN_TRANSITION_MS = 1500;

type Stage = "closed" | "intro" | "loading";

export function DemoHeroCard() {
  const router = useRouter();
  const { theme } = usePortalTheme();
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<Stage>("closed");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // Escape closes the intro only — never interrupt the ready transition.
  useEffect(() => {
    if (stage !== "intro") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setStage("closed"); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [stage]);

  async function explore() {
    setError(null);
    setStage("loading");
    setStep(0);
    const startedAt = Date.now();
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 480);
    try {
      const { transactionId } = await getOrCreateDemoSaleAction();
      clearInterval(ticker);
      setStep(STEPS.length); // all ticked
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

  return (
    <>
      {/* ── Hero card ─────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--agent-radius-xl)",
          marginBottom: 18,
          minHeight: 200,
          padding: "30px 32px",
          border: "1px solid var(--agent-border-subtle)",
          background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
        }}
      >
        {/* Glass-house artwork, right side, fading into the card. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/demo-hero-bg.png" alt="" aria-hidden
          style={{
            position: "absolute", right: 0, top: 0, height: "100%", width: "auto", maxWidth: "44%",
            objectFit: "cover", objectPosition: "center", pointerEvents: "none",
            WebkitMaskImage: "linear-gradient(to right, transparent, #000 42%)",
            maskImage: "linear-gradient(to right, transparent, #000 42%)",
          }}
        />
        <div style={{ position: "relative", maxWidth: 540 }}>
          <Pill tone="brand" size="sm" style={{ marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            New here?
          </Pill>
          <p style={{ margin: "0 0 8px", fontSize: 27, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: 1.15 }}>
            Let&apos;s add your first sale
          </p>
          <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 430 }}>
            Add a memo of sale to see how a sale runs through Sales Progressor, or fill in the details yourself.
          </p>
          <button
            type="button"
            onClick={() => { setError(null); setStage("intro"); }}
            className="agent-btn agent-btn-secondary agent-btn-md"
            style={{ gap: 10, paddingLeft: 6, paddingRight: 18 }}
          >
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--agent-coral-deep)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Play size={14} weight="fill" style={{ marginLeft: 1 }} />
            </span>
            See how it works
          </button>
        </div>
      </div>

      {/* ── Modal (intro / loading) ───────────────────────────────────────── */}
      {mounted && stage !== "closed" && createPortal(
        <div
          data-theme={theme}
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={stage === "intro" ? () => setStage("closed") : undefined}
        >
          <div className="fixed inset-0 agent-backdrop-overlay" />
          <div
            className="agent-modal"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: 440, width: "calc(100vw - 48px)", position: "relative", padding: 0, overflow: "hidden", animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both" }}
            onClick={(e) => e.stopPropagation()}
          >
            {stage === "intro" ? (
              <>
                <button
                  onClick={() => setStage("closed")}
                  aria-label="Close"
                  className="agent-icon-btn agent-icon-btn-sm"
                  style={{ position: "absolute", top: 12, right: 12, zIndex: 1 }}
                >
                  <X size={14} weight="bold" />
                </button>
                <div style={{ padding: "28px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(var(--agent-coral-rgb),0.14)", color: "var(--agent-coral-deep)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                      <Sparkle size={22} weight="fill" />
                    </span>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>
                      See Sales Progressor in action
                    </p>
                    <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
                      Explore a fully worked example with progress, updates, tasks and activity already in place.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={explore}
                    className="agent-btn agent-btn-color-primary"
                    style={{ width: "100%", justifyContent: "center", padding: "13px 20px", fontSize: 15, fontWeight: 700 }}
                  >
                    Explore demo sale
                  </button>
                  <p style={{ textAlign: "center", fontSize: 12, color: "var(--agent-text-muted)", margin: 0 }}>
                    It&apos;s all sample data. Nothing here affects a real sale.
                  </p>
                  {error && (
                    <p role="alert" style={{ textAlign: "center", fontSize: 12.5, color: "var(--agent-danger, #dc2626)", margin: 0 }}>{error}</p>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: "34px 28px", display: "flex", flexDirection: "column", gap: 22, alignItems: "center", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>
                  Getting your demo ready&hellip;
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, alignSelf: "stretch", maxWidth: 240, margin: "0 auto" }}>
                  {STEPS.map((label, i) => {
                    const done = step > i;
                    const active = step === i;
                    return (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 11, opacity: done || active ? 1 : 0.4, transition: "opacity 200ms" }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: done ? "var(--agent-coral-deep)" : "transparent",
                          border: done ? "none" : "1.5px solid var(--agent-border-strong, rgba(15,23,42,0.18))",
                          color: done ? "#fff" : "var(--agent-coral-deep)",
                        }}>
                          {done ? <Check size={13} weight="bold" /> : active ? <CircleNotch size={13} weight="bold" className="agent-spin" /> : null}
                        </span>
                        <span style={{ fontSize: 13.5, fontWeight: done || active ? 600 : 500, color: "var(--agent-text-primary)" }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
